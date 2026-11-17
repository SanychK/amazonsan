-- AMAZONSAN: run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  subcategory text,
  price_uah numeric(12,2),
  price_usd numeric(12,2),
  description text,
  image_url text,
  amazon_url text,
  sku text,
  specs jsonb not null default '[]'::jsonb,
  is_new boolean not null default false,
  is_popular boolean not null default false,
  status text not null default 'published' check (status in ('published','draft')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_admin = true); $$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles for select using (id = auth.uid() or public.is_admin());
-- Profile writes are intentionally restricted: users must not be able to
-- change their own is_admin flag through the public API. Admin promotion is
-- performed manually by the project owner in the SQL editor.
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "products public read published" on public.products;
create policy "products public read published" on public.products for select using (status = 'published' or public.is_admin());
drop policy if exists "products admin insert" on public.products;
create policy "products admin insert" on public.products for insert with check (public.is_admin());
drop policy if exists "products admin update" on public.products;
create policy "products admin update" on public.products for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products admin delete" on public.products;
create policy "products admin delete" on public.products for delete using (public.is_admin());
drop policy if exists "favorites own all" on public.favorites;
create policy "favorites own all" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create profile automatically for each new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage bucket for product images. Public read, authenticated admin write.
insert into storage.buckets (id, name, public) values ('product-images','product-images',true)
on conflict (id) do nothing;
drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product images admin upload" on storage.objects;
create policy "product images admin upload" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- IMPORTANT: after signing up, promote YOUR user to administrator.
-- Replace YOUR-LOGIN-EMAIL with the email used to register:
-- update public.profiles set is_admin = true where email = 'YOUR-LOGIN-EMAIL';

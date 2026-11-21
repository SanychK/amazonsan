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



-- Private product inquiries: visitors may submit a contact request; only admins can read/update it.
create table if not exists public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  price_uah numeric(12,2),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_contact text not null check (char_length(customer_contact) between 3 and 180),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new','contacted','discussing','completed','declined')),
  created_at timestamptz not null default now()
);
alter table public.product_inquiries enable row level security;
drop policy if exists "visitors submit product inquiries" on public.product_inquiries;
create policy "visitors submit product inquiries" on public.product_inquiries for insert to anon, authenticated
  with check (status = 'new');
drop policy if exists "admins read product inquiries" on public.product_inquiries;
create policy "admins read product inquiries" on public.product_inquiries for select to authenticated
  using (public.is_admin());
drop policy if exists "admins update product inquiries" on public.product_inquiries;
create policy "admins update product inquiries" on public.product_inquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

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

-- AMAZONSAN growth features: inventory, pricing labels and editorial merchandising.
alter table public.products add column if not exists original_price_uah numeric(12,2);
alter table public.products add column if not exists stock_status text not null default 'in_stock' check (stock_status in ('in_stock','out_of_stock'));
alter table public.products add column if not exists is_best_seller boolean not null default false;
alter table public.products add column if not exists is_recommended boolean not null default false;
alter table public.products add column if not exists is_exclusive boolean not null default false;
alter table public.products add column if not exists is_editor_pick boolean not null default false;
alter table public.products add column if not exists is_deal_of_day boolean not null default false;

-- Product reviews are private until moderated by the catalog owner.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  rating integer not null check (rating between 1 and 5),
  review_text text check (review_text is null or char_length(review_text) <= 2000),
  verified_purchase boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;
drop policy if exists "approved reviews public read" on public.product_reviews;
create policy "approved reviews public read" on public.product_reviews for select using (is_approved = true or public.is_admin());
drop policy if exists "signed in users submit reviews" on public.product_reviews;
create policy "signed in users submit reviews" on public.product_reviews for insert to authenticated with check (user_id = auth.uid() and is_approved = false and verified_purchase = false);
drop policy if exists "admins moderate reviews" on public.product_reviews;
create policy "admins moderate reviews" on public.product_reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Price-drop / restock alerts. Delivery requires a separately configured email provider or Edge Function.
create table if not exists public.product_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  email text not null check (char_length(email) between 5 and 254),
  alert_type text not null check (alert_type in ('price_drop','back_in_stock')),
  target_price_uah numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id,email,alert_type)
);
alter table public.product_alerts enable row level security;
drop policy if exists "visitors subscribe product alerts" on public.product_alerts;
create policy "visitors subscribe product alerts" on public.product_alerts for insert to anon, authenticated with check (is_active = true);
drop policy if exists "admins manage product alerts" on public.product_alerts;
create policy "admins manage product alerts" on public.product_alerts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Owner-controlled homepage feature flags and promotional campaigns.
create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.site_settings enable row level security;
drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings" on public.site_settings for select using (true);
drop policy if exists "admins manage site settings" on public.site_settings;
create policy "admins manage site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  label text not null,
  description text,
  image_url text,
  target_url text,
  is_sponsored boolean not null default false,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.promo_campaigns enable row level security;
drop policy if exists "public read active campaigns" on public.promo_campaigns;
create policy "public read active campaigns" on public.promo_campaigns for select using (is_active = true or public.is_admin());
drop policy if exists "admins manage campaigns" on public.promo_campaigns;
create policy "admins manage campaigns" on public.promo_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

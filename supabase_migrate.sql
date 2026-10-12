-- Add missing columns to existing orders table
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists coupon_discount numeric default 0;
alter table orders add column if not exists razorpay_payment_id text;
alter table orders add column if not exists razorpay_order_id text;
alter table orders add column if not exists razorpay_signature text;
alter table orders add column if not exists shipping_cost numeric default 50;
alter table orders add column if not exists tax numeric default 0;
alter table orders add column if not exists subtotal numeric default 0;
alter table orders add column if not exists items jsonb;
alter table orders add column if not exists shipping_address jsonb;
alter table orders add column if not exists user_email text;
alter table orders add column if not exists payment_status text default 'pending';
alter table orders add column if not exists order_status text default 'pending';
alter table orders add column if not exists updated_at timestamptz default now();

# Custom Domain Setup: app.paperplan.co

## Step 1: Configure DNS in Cloudflare

1. Log in to [Cloudflare](https://dash.cloudflare.com)
2. Select your `paperplan.co` domain
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure as follows:
   - **Type**: `CNAME`
   - **Name**: `app`
   - **Target**: `cname.vercel-dns.com`
   - **Proxy status**: **DNS only** (click the orange cloud to make it gray)
   - **TTL**: Auto

⚠️ **Important**: The proxy must be OFF (gray cloud) for Vercel to work properly.

## Step 2: Configure Domain in Vercel

1. Go to your [Vercel project settings](https://vercel.com/paperplancallums-projects/ps/settings/domains)
2. Click **Add Domain**
3. Enter `app.paperplan.co`
4. Click **Add**
5. Vercel will verify the DNS configuration

## Step 3: Update Environment Variable

Once the domain is verified (usually takes a few minutes):

1. Go to [Environment Variables](https://vercel.com/paperplancallums-projects/ps/settings/environment-variables)
2. Add/Update:
   - **Key**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://app.paperplan.co`
3. Click **Save**

## Step 4: Redeploy

The project will automatically redeploy with the new domain.

## Verification

After setup, test by visiting:
- https://app.paperplan.co

## SSL Certificate

Vercel automatically provisions an SSL certificate once DNS propagates (usually within minutes).

## Troubleshooting

If the domain doesn't work:
1. Ensure Cloudflare proxy is OFF (DNS only)
2. Wait 5-10 minutes for DNS propagation
3. Check Vercel domains page for any error messages
4. Make sure the CNAME record points to `cname.vercel-dns.com`
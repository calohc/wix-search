# Wix Product Search Widget

A self-hosted product search bar for Wix Harmony, deployed on Vercel.

## Deploy in 5 steps

### 1. Upload to GitHub
- Go to github.com and create a new repository (e.g. `wix-search`)
- Upload all these files keeping the same folder structure:
  ```
  api/products.js
  public/index.html
  vercel.json
  ```

### 2. Import to Vercel
- Go to vercel.com → Add New Project
- Connect your GitHub account and select the `wix-search` repo
- Click Deploy (it will fail first time — that's fine, next step fixes it)

### 3. Add environment variables in Vercel
- In your Vercel project → Settings → Environment Variables
- Add these two variables:

  | Name | Value |
  |------|-------|
  | `WIX_API_KEY` | Your Wix API key (IST.eyJ...) |
  | `WIX_SITE_ID` | `8f298bec-d0f1-410a-aa4d-78db3f636b50` |
  | `WIX_SITE_DOMAIN` | Your Wix site's public domain (e.g. mystore.com) |

- After adding variables, go to Deployments → click the 3 dots on the latest → Redeploy

### 4. Test it
- Visit `https://your-vercel-app.vercel.app` — you should see the search bar
- Type a product name to confirm results appear

### 5. Embed in Wix Harmony
- In your Harmony editor, click **+ Add** → **Embed** → **Embed a Widget** (iFrame)
- Paste your Vercel URL: `https://your-vercel-app.vercel.app`
- Resize to fit (recommended: full width, ~60px height collapsed / ~400px with results)

## Security reminder
Rotate your Wix API key after setting it in Vercel environment variables,
since it was shared in plain text. Go to Wix Account Settings → API Keys → Rotate.

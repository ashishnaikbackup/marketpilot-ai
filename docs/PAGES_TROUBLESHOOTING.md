# GitHub Pages troubleshooting

## What was wrong

The repository had a React/Vite build-and-deploy workflow at `.github/workflows/deploy-pages.yml`, but the latest Pages deployment was running GitHub's generated `dynamic/pages/pages-build-deployment` Jekyll workflow instead. That is the branch-publishing path, not the custom Vite workflow. It can publish the repository root/README rather than the compiled React application under `frontend/dist`.

The custom workflow already:
1. installs the frontend dependencies;
2. runs `npm run build`;
3. uploads `frontend/dist` as the Pages artifact;
4. deploys the artifact.

The Vite config already sets the project base path to `/marketpilot-ai/` in GitHub Actions, and `frontend/public/.nojekyll` is included so static assets are not processed by Jekyll.

## One required repository setting

GitHub Pages publishing source is a repository setting and cannot be changed by a normal source-code commit.

1. Open [MarketPilot repository settings](https://github.com/ashishnaikbackup/marketpilot-ai/settings/pages).
2. Find **Build and deployment**.
3. Set **Source** to **GitHub Actions** (not **Deploy from a branch**).
4. Save if GitHub presents a Save button.
5. Open [Actions](https://github.com/ashishnaikbackup/marketpilot-ai/actions) and confirm **Deploy MarketPilot AI frontend to GitHub Pages** completes successfully.
6. Visit [the dashboard](https://ashishnaikbackup.github.io/marketpilot-ai/). On mobile, refresh the page or open it in a private tab if an older cached page remains.

The custom workflow is triggered by frontend changes, documentation changes and manual dispatch. If the workflow does not appear, check that the Pages source is set to GitHub Actions and that Actions are enabled for the repository.

## Important architecture boundary

GitHub Pages serves static files. It cannot run the FastAPI service, keep a background process alive, protect API credentials, or provide an authorised NSE market-data feed. The UI can still run in demo/manual-data mode without the API. For AI chat and backend calculations, deploy the Cloudflare Worker separately and enter its URL in the Copilot/Backtest modules. The Worker has not been deployed to a Cloudflare account until the account's deployment credentials are configured.

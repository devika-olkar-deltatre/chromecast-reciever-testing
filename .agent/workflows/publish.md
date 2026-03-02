---
description: How to publish/release the Testing diva Chromecast Receiver
---

# Publish Workflow – Testing diva Chromecast Receiver

Follow these steps in order to cut a release and deploy it to an environment.

## 1. Ensure your branch is up to date

Make sure you are on the correct branch (e.g. `develop` or `main`) and that it is up to date with the remote.

```
git pull origin <branch>
```

## 2. Bump the version (optional)

If this is a new release, update the `version` field in `package.json`:

```
"version": "X.Y.Z"
```

Commit and push the version bump:

```
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin <branch>
```

## 3. Create a GitHub Release and Tag

1. Go to your repository on GitHub.
2. Click **"Releases"** in the right-hand sidebar, then **"Create a new release"**.
3. In **"Choose a tag"**, type your version (e.g. `1.0.37`) and select **"Create new tag: 1.0.37 on publish"**.
4. Set the **Release title** to the same version string (e.g. `1.0.37`).
5. Add any release notes describing what changed.
6. Click **"Publish release"**.

## 4. Trigger the Deploy Action

1. In your repository, go to **Actions → Deploy**.
2. Click **"Run workflow"**.
3. Fill in the inputs:
   - **Environment**: choose `Test`, `Staging`, or `Production`.
   - **Include OS Debugger?**: leave unchecked unless you need on-screen debugging.
   - **Tag to deploy**: enter the tag you just created (e.g. `1.0.37`).
4. Click **"Run workflow"** to start the deployment.

The workflow will:
- Check out the tagged commit.
- Install dependencies with Yarn.
- Build the receiver bundle (`yarn build --mode production`).
- Upload the built artefact.
- Push the `dist/` folder to the configured AWS S3 bucket.

## 5. Verify the deployment

After the workflow completes successfully:
- Confirm the S3 bucket path has been updated with the new files.
- Cast to a Chromecast device and verify the receiver loads correctly.
- Check the receiver version displayed in the on-screen OSD debugger (if enabled).

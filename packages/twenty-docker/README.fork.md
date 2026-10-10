# Fork container images

The `Fork container image` workflow builds the `twenty` Dockerfile target with
the backend and frontend. The server and worker use the same image, with the
worker selecting `yarn worker:prod` as its command.

## Build and publication

- Pull requests build the image and check its runtime artifacts without publishing.
- Pushes to `main` publish `ghcr.io/kodexx-pro/twenty-crm:edge`, `:main`, and a
  `:sha-<full commit>` tag.
- Tags starting with `v` publish the matching tag and commit tag. Stable releases
  such as `v1.0.0` also update `:latest`; prereleases such as `v1.0.0-rc.1` do not.
- Manual runs let you select a branch or tag. Publication is disabled by default.
  Enable the `publish` input to publish branch and commit tags for a reviewed branch.

The first version supports `linux/amd64`. The workflow uses `GITHUB_TOKEN` with
`packages: write`; no Docker Hub or Twenty infrastructure credentials are needed.
The image source label links the GHCR package to this repository. If a package
with the same name already exists, grant this repository Actions write access to it.

Enable GitHub Actions on the fork if GitHub displays a disabled-workflows banner.
The workflow must reach the default branch before GitHub offers its manual run
button. After the first publication, set the GHCR package visibility to public
for unauthenticated pulls, or authenticate deployment hosts for private packages.

`APP_VERSION` comes from the server's `TWENTY_CURRENT_VERSION`, independently of
the fork's image tags. Keep this upstream application version aligned with its
database upgrade commands when updating the fork.

## Docker Compose

Copy `.env.example` to `.env` and configure the database, URL and secrets as usual.
Both services default to the fork's `edge` image. To deploy a release, set
`TAG=v1.0.0`; to deploy an exact build, set `TAG=sha-<full commit>`. Keep the same
tag for server and worker. `IMAGE_REPOSITORY` can select another registry image.

Run `docker compose pull` and then `docker compose up -d` from this directory
after publishing the selected image. Jobs that dispatch deployment, preview,
review and translation work to Twenty-hosted repositories are skipped on the fork.

The workflow's artifact check verifies the server entrypoint, worker entrypoint,
frontend HTML and runtime user. It does not exercise database migrations or a
running application; validate those in staging before a production deployment.

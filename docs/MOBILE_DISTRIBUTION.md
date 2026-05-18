# Mobile Distribution

Use Xcode Cloud for iOS TestFlight/App Store distribution. Use GitHub Actions
for Android artifacts and Google Play upload.

## Triggers

- Manual artifact build: Actions -> `android-release`
- Manual Play upload: Actions -> `mobile-release`
- Tags:
  - `android-v*` builds signed Android release artifacts
  - `android-v*-debug` builds a debug APK artifact without release signing
  - `mobile-v*` uploads iOS and Android through `mobile-release`
  - `android-play-v*` uploads Android to Google Play through `mobile-release`

## iOS

Uploads to App Store Connect / TestFlight are owned by Xcode Cloud. Keep the
GitHub `mobile-release` iOS lane as a manual fallback only.

Required GitHub secrets:

- `ASC_API_KEY_ID`
- `ASC_API_ISSUER_ID`
- `ASC_API_KEY_P8_BASE64`
- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `IOS_PROVISIONING_PROFILE_SPECIFIER`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`

Optional:

- `IOS_KEYCHAIN_PASSWORD`

The workflow sets `CURRENT_PROJECT_VERSION` from `github.run_number`, so each
upload has a unique App Store Connect build number.

## Android Artifacts

The `android-release` workflow builds Android artifacts:

- `android-v*`: signed release `.aab` and `.apk`
- `android-v*-debug`: debug `.apk`

Release artifact builds require:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`

## Android Play

Builds release `.aab` and `.apk` artifacts, then uploads the `.aab` to Google
Play from the `mobile-release` workflow.

Required GitHub secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`

The workflow sets `ANDROID_VERSION_CODE` from `github.run_number`, so each
upload has a unique Play Console version code.

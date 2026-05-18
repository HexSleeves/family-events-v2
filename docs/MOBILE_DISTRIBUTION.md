# Mobile Distribution

Use the `mobile-release` GitHub Actions workflow to upload release builds.

## Triggers

- Manual run: Actions -> `mobile-release`
- Tags:
  - `mobile-v*` uploads iOS and Android
  - `ios-v*` uploads iOS
  - `android-v*` uploads Android

## iOS

Uploads to App Store Connect / TestFlight.

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

## Android

Builds release `.aab` and `.apk` artifacts, then uploads the `.aab` to Google
Play.

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

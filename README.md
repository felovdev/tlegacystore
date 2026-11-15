# IPA Catalog

Static, mobile-friendly IPA archive browser for GitHub Pages.

## GitHub Pages
In repository Settings → Pages choose **Deploy from a branch**, branch **main**, folder **/ (root)**. The site will be available at https://felovdev.github.io/tlegacystore/.

## Firebase setup (required for shared comments)
1. Create a project at https://console.firebase.google.com/.
2. Add a Web App and copy its Firebase web config into `firebase-config.js`.
3. In Firebase Console → Firestore Database create a database.
4. Open Firestore → Rules and publish the contents of `firestore.rules`.
5. Wait a few minutes for GitHub Pages to redeploy.

The Firebase web config is public by design; Firestore Security Rules protect the database. Never put service-account keys or Admin SDK credentials in frontend files.

## Comments
- Maximum message length: **500 characters**, enforced in UI and Firestore rules.
- Client-side cooldown: **20 seconds** between submissions per browser.
- Shared comments use Cloud Firestore collection `comments`.
- Name limit: 40 characters.
- Without a valid Firebase config, comments are disabled with a setup notice.

Important: the 20-second cooldown in this static build is browser-side and can be bypassed by a visitor clearing browser storage or using another browser/device. For a strict global anti-spam cooldown, add Firebase Anonymous Authentication plus a trusted Cloud Function (or App Check/rate-limiting backend). Firestore rules enforce the message length, not a global per-person timer.

## Data sources
The catalogue queries the Internet Archive Advanced Search API and uses its Metadata API for individual records and thumbnails. iOS version, categories, Decrypted and Cracked flags are inferred from metadata text; they are not cryptographic verification.

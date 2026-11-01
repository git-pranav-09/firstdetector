# DefectIQ Lite — Netlify Deployment Package

This is a **browser-only deployment version** of DefectIQ Lite v0.1.

Important: the original Python/Streamlit version cannot run on Netlify because Netlify hosts static websites and serverless functions, not a persistent Streamlit Python server. This package converts the inspection workflow into a static HTML, CSS, and JavaScript application that can be deployed to Netlify.

## What works on Netlify

- Upload or capture fabric images.
- Run browser-based local texture-anomaly analysis.
- View candidate bounding boxes.
- Confirm, reject, or mark candidates for further inspection.
- Save inspection records in the browser's localStorage.
- Export inspection history as CSV.
- Generate a printable PDF report using the browser print dialog.

No image is uploaded to a server. Processing happens in the user's browser.

## Deploy to Netlify

### Option 1: Drag and drop

1. Extract this ZIP.
2. Go to https://app.netlify.com/drop
3. Drag the extracted `DefectIQ_Lite_Netlify` folder onto the page.
4. Netlify will provide a public URL.

### Option 2: GitHub + Netlify

1. Create a new GitHub repository.
2. Upload all files from this folder.
3. In Netlify, choose **Add new site → Import an existing project**.
4. Select the repository.
5. Leave the build command empty.
6. Set publish directory to `.`.
7. Deploy.

## Important limitations

- Inspection history is stored only in the browser localStorage of each device.
- Clearing browser data can delete saved inspection records.
- This is not a trained AI model and does not provide defect probabilities.
- All results require human verification.
- This browser version is intended for demonstration and early user feedback, not production quality control.

## Files

```text
index.html
styles.css
app.js
netlify.toml
assets/favicon.svg
README-NETLIFY.md
```

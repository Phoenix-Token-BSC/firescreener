const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
// Note: Use 'node --env-file=.env scripts/upload-cloudinary.js' to run this script if using Node.js v20.6.0+
// Alternatively, install dotenv and require it at the top.
// We are expecting environment variables to be loaded.

const config = {
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
};

if (!config.cloud_name || !config.api_key || !config.api_secret) {
    console.error('Missing Cloudinary configuration. specific environment variables are required.');
    // console.log('Ensure NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.');
    process.exit(1);
}

cloudinary.config(config);

const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
if (!uploadPreset) {
    console.error('Missing CLOUDINARY_UPLOAD_PRESET environment variable.');
    process.exit(1);
}

const sourceFolders = [
    {
        localPath: 'public/images/bsc/token-logos',
        remoteFolder: 'bsc',
    },
    {
        localPath: 'public/images/rwa/token-logos', // Adjusted based on finding "rwa/token-logos"
        remoteFolder: 'rwa',
    },
];

async function uploadImage(filePath, remoteFolder) {
    try {
        const filename = path.basename(filePath, path.extname(filePath));
        const versionSuffix = `_v${Date.now()}`;
        // Public ID format: folder/filename_version
        // Note: Cloudinary folders in public_id include the folder path.
        // If we use 'folder' option in upload, it prepends it. 
        // Let's use public_id explicitly to control specific naming if needed, 
        // or just let Cloudinary handle folders via the 'folder' parameter.
        // The request asked for "only bsc and rwa folders" in Cloudinary.

        // We will use the 'folder' parameter to specify the remote directory.
        // And modify the public_id to be just the filename + suffix.
        // Wait, if we set folder='bsc', and public_id='token_suffix', the result is 'bsc/token_suffix'.

        const result = await cloudinary.uploader.upload(filePath, {
            upload_preset: uploadPreset,
            folder: remoteFolder,
            public_id: `${filename}${versionSuffix}`,
            overwrite: true, // We are using unique suffixes, so overwrite shouldn't matter for *this* specific file, but good practice if logic changes.
            resource_type: 'image',
        });

        // console.log(`Uploaded: ${filePath} -> ${result.secure_url}`);
        return result;
    } catch (error) {
        console.error(`Failed to upload ${filePath}:`, error.message);
        return null;
    }
}

async function processFolder(folderConfig) {
    const absolutePath = path.resolve(process.cwd(), folderConfig.localPath);

    if (!fs.existsSync(absolutePath)) {
        console.warn(`Directory not found: ${absolutePath}`);
        return;
    }

    const files = fs.readdirSync(absolutePath);
    // console.log(`Processing ${files.length} files in ${folderConfig.localPath}...`);

    for (const file of files) {
        // Basic image extension check
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file)) {
            const filePath = path.join(absolutePath, file);
            await uploadImage(filePath, folderConfig.remoteFolder);
        }
    }
}

async function main() {
    // console.log('Starting Cloudinary upload...');

    for (const folder of sourceFolders) {
        await processFolder(folder);
    }

    // console.log('Upload complete.');
}

main();

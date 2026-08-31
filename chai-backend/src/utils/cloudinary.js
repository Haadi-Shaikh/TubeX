import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_API_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadFileOnCloudinary = async (filePath) => {
  try {
    if (!filePath) return null;

    const res = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    console.log("File has been uploaded successfully", res);

    fs.unlinkSync(filePath);
    return res;
  } catch (error) {
    fs.unlinkSync(filePath);
    return null;
  }
};

const deleteOnCloudinary = async (filePath, resource_type = "image") => {
  try {
    if (!filePath) return null;

    const res = await cloudinary.uploader.destroy(filePath, {
      resource_type: `${resource_type}`,
    });

    return res;
  } catch (error) {
    console.error("Delete on cloudinary:", error);
  }
};

export { uploadFileOnCloudinary, deleteOnCloudinary };

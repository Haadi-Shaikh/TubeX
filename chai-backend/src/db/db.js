import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log("MONGO DB : DB HOST :", connInstance.connection.host);
  } catch (error) {
    throw error;
    process.exit(1); // application will terminate
  }
};

export default connectDB;

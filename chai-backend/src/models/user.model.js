import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    avatar: {
      type: {
        public_id: String,
        url: String,
      },
      required: true,
    },

    coverImage: {
      type: {
        public_id: String,
        url: String,
      },
    },

    refreshToken: {
      type: String,
    },

    watchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],

    password: {
      type: String,
      required: [true, "Password is required"],
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
  // there is no need to write next function to hop onto the other middlewares
  //bcuz after completing the task async func returns a promise
  //Suppose before task is complete the promise.resolve(undefined)
  // after When the function reaches the end, the Promise is automatically resolved.
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this.id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },

    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this.id,
    },

    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);

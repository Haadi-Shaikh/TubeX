import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
  deleteOnCloudinary,
  uploadFileOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// frontend --> req --> form-data
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;
  // we use optional chaining in place where we suspicious about the data is there or not
  // so it can't crash out
  // console.log(req.body);
  if (
    [fullName, username, email, password].some((field) => field?.trim() == "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "Given email or username are already exists");
  }
  // console.log("Files :", req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // to tackle undefined error getting bcuz of optional chaining

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is required");
  }

  const avatar = await uploadFileOnCloudinary(avatarLocalPath);
  const coverImage = await uploadFileOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(409, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    avatar: {
      public_id: avatar?.public_id,
      url: avatar?.secure_url,
    },
    coverImage: {
      public_id: coverImage?.public_id || "",
      url: coverImage?.secure_url || "",
    },
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, createdUser, "user has registered successfully")
    );
});

const generateAccessRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    // console.log("USER :", user);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

// frontend --> req --> JSON data
const loginUser = asyncHandler(async (req, res) => {
  // console.log(req.body);
  const { username, email, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }], // operators
  });

  if (!user) {
    throw new ApiError(401, "User is not exist register before login");
  }
  // console.log("login user :", user);

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessRefreshToken(
    user._id
  );
  // if you are destructuring properties from an async func make sure to use await

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully "
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // console.log("Request :", req);

  await User.findByIdAndUpdate(
    // Note : when we used $set to update refreshToken to undefined mongodb ignores it and it won't be reflected on db
    req.user?._id,
    {
      $unset: {
        refreshToken: 1, // using unset the field is removed from db
      },
    },
    {
      returnDocument: "after", // new value should be updated right now
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const accessRefreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // console.log("incoming :", incomingRefreshToken);

  if (!incomingRefreshToken) {
    throw new ApiError(400, "Invalid Refresh Token");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(400, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  const user = await User.findById(req?.user._id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid Password");
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "Invalid confirm password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password has change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req?.user;

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Current User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "All Fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      returnDocument: "after",
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file.path;

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is required");
  }

  const prevUser = await User.findById(req.user?._id);

  const avatar = await uploadFileOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(409, "Avatar file is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: {
          public_id: avatar?.public_id,
          url: avatar?.secure_url,
        },
      },
    },
    {
      returnDocument: "after",
    }
  ).select("-password");

  if (!user) {
    throw new ApiError(400, "Error occured while updating avatar");
  }

  await deleteOnCloudinary(prevUser.avatar.public_id);

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file.path;

  if (!coverImageLocalPath) {
    throw new ApiError(404, "CoverImage file is required");
  }

  const prevUser = await User.findById(req.user?._id);

  const coverImage = await uploadFileOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(404, "CoverImage file is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: {
          public_id: coverImage?.public_id,
          url: coverImage?.secure_url,
        },
      },
    },
    {
      returnDocument: "after",
    }
  ).select("-password");

  await deleteOnCloudinary(prevUser.coverImage?.public_id);

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "coverImage updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },

    {
      $lookup: {
        from: "subscriptions", // Mongodb makes the model plural and in lower case
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },

    {
      $lookup: {
        from: "subscriptions", // Mongodb makes the model plural and in lower case
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },

    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers", // size op is used to return the no of subscriber
        },

        channelSubscribeToCount: {
          $size: "$subscribedTo", // how much we have subscribed
        },

        isSubscribe: {
          $cond: {
            if: { $in: [req?.user._id, "$subscribers.subscriber"] }, // if my id is there then
            then: true,
            else: false,
          },
        },
      },
    },

    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        isSubscribe: 1,
        subscribersCount: 1,
        channelSubscribeToCount: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(400, "channel does not exists");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully ")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },

                {
                  $addFields: {
                    owner: {
                      $first: "$owner",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  accessRefreshToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};

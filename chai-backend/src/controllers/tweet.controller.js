import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Invalid Content");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });

  if (!tweet) {
    throw new ApiError(400, "Something went wrong while creating a tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet is created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw new ApiError(404, "User not found");
  }

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              fullName: 1,
            },
          },
        ],
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likes",
      },
    },

    {
      $lookup: {
        from: "dislikes",
        localField: "_id",
        foreignField: "tweet",
        as: "dislikes",
      },
    },

    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },

        dislikesCount: {
          $size: "$dislikes",
        },

        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },

        isDisliked: {
          $cond: {
            if: { $in: [req.user?._id, "$dislikes.dislikedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },

    {
      $project: {
        content: 1,
        owner: 1,
        likesCount: 1,
        dislikesCount: 1,
        isLiked: 1,
        isDisliked: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!tweets && tweets.length < 0) {
    throw new ApiError(400, "Something went wrong while fetching the tweets");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "User Tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet Id");
  }

  const tweetExists = await Tweet.findOne({
    _id: tweetId,
    owner: req.user?._id,
  });
  if (!tweetExists) {
    throw new ApiError(404, "Tweet is not found");
  }

  if (!content.trim()) {
    throw new ApiError(400, "Invalid content details");
  }

  const updatedTweet = await Tweet.findOneAndUpdate(
    {
      _id: tweetId,
      owner: req.user?._id,
    },
    {
      $set: {
        content,
      },
    },
    {
      returnDocument: "after",
    }
  );

  if (!updatedTweet) {
    throw new ApiError(400, "Something went wrong while updating...");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet Id");
  }

  const tweetExists = await Tweet.findOne({
    _id: tweetId,
    owner: req.user?._id,
  });

  if (!tweetExists) {
    throw new ApiError(404, "Tweet is not found");
  }

  const deletedTweet = await Tweet.findOneAndDelete({
    _id: tweetId,
    owner: req.user?._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };

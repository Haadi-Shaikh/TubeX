import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle like on video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid ID");
  }

  const likedVideo = await Like.findOne({
    video: videoId,
    likedBy: req.user?._id,
  });

  if (likedVideo) {
    await Like.findByIdAndDelete(likedVideo?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Video unliked successfully")
      );
  } else {
    await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //TODO: toggle like on comment
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid ID");
  }

  const likedComment = await Like.findOne({
    comment: commentId,
    likedBy: req.user?._id,
  });

  if (likedComment) {
    await Like.findByIdAndDelete(likedComment?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Comment unliked successfully")
      );
  }

  await Like.create({
    comment: commentId,
    likedBy: req.user?._id,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { isLiked: true }, "Comment liked successfully")
    );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //TODO: toggle like on tweet

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid ID");
  }

  const likedTweet = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?._id,
  });

  if (likedTweet) {
    await Like.findByIdAndDelete(likedTweet?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully")
      );
  }
  
  await Like.create({
    tweet: tweetId,
    likedBy: req.user?._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos
  const likedVideoAggregate = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user._id),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
            },
          },

          {
            $unwind: "$ownerDetails",
          },
        ],
      },
    },

    {
      $unwind: "$likedVideo",
    },

    {
      $project: {
        _id: 0,
        likedBy: 1,
        video: 1,
        likedVideo: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        likedVideoAggregate,
        "Liked Videos has been fetch successfully"
      )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };

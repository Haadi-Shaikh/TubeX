import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Dislike } from "../models/dislike.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleVideoDislike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const dislikeVideo = await Dislike.findOne({
    video: videoId,
    dislikedBy: req.user?._id,
  });

  if (dislikeVideo) {
    await Dislike.findByIdAndDelete(dislikeVideo._id);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: false },
          "Video dislike toggle successfully"
        )
      );
  } else {
    await Dislike.create({
      video: videoId,
      dislikedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: true },
          "Video is disliked successfully"
        )
      );
  }
});

const toggleCommentDislike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //TODO: toggle like on comment
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid ID");
  }

  const dislikedComment = await Dislike.findOne({
    comment: commentId,
    dislikedBy: req.user?._id,
  });

  if (dislikedComment) {
    await Dislike.findByIdAndDelete(dislikedComment?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: false },
          "Comment undisliked successfully"
        )
      );
  } else {
    await Dislike.create({
      comment: commentId,
      dislikedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: true },
          "Comment disliked successfully"
        )
      );
  }
});

const toggleTweetDislike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //TODO: toggle like on tweet

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid ID");
  }

  const dislikedTweet = await Dislike.findOne({
    tweet: tweetId,
    dislikedBy: req.user?._id,
  });

  if (dislikedTweet) {
    await Dislike.findByIdAndDelete(dislikedTweet?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: false },
          "Tweet undisliked successfully"
        )
      );
  } else {
    await Dislike.create({
      tweet: tweetId,
      dislikedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isDisliked: true },
          "Tweet disliked successfully"
        )
      );
  }
});

export { toggleCommentDislike, toggleVideoDislike, toggleTweetDislike };

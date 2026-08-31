import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const videoComments = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },

    {
      $lookup: {
        from: "dislikes",
        localField: "_id",
        foreignField: "comment",
        as: "dislikes",
      },
    },

    {
      $unwind: "$owner",
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
      $sort: {
        createdAt: -1,
      },
    },

    {
      $project: {
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
        updatedAt: 1,
        content: 1,
        likesCount: 1,
        dislikesCount: 1,
        isLiked: 1,
        isDisliked: 1,
      },
    },
  ]);

  console.log(videoComments);

  const options = {
    page: Number(page),
    limit: Number(limit),
  };

  const result = await Comment.aggregatePaginate(videoComments, options);

  return res.status(200).json(new ApiResponse(200, result, "Testing"));
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { content } = req.body;
  const { videoId } = req.params;

  // before adding a comment check whether that user is comment is already exists or not

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user._id,
  });

  if (!comment) {
    throw new ApiError(400, "Something is missing");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comment,
        "comment has been created or added successfully"
      )
    );
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const updateComment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
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

  if (!updateComment) {
    throw new ApiError(400, "Error occured while updating comment");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updateComment,
        "Comment has been updated successfully"
      )
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  await Comment.findOneAndDelete({
    _id: commentId,
    owner: req.user?._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment has been deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };

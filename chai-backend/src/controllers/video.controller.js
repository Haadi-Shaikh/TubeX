import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteOnCloudinary,
  uploadFileOnCloudinary,
} from "../utils/cloudinary.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Dislike } from "../models/dislike.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  console.log(query);
  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "Search-videos",
        text: {
          query: query,
          path: ["title", "description"], //search only on title, desc
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid userId");
    }

    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  pipeline.push({ $match: { isPublished: true } });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );

  const videoAggregate = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
});
// create a controller to fetch all the videos uploaded or created by a user // getUserVideos

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const owner = req.user?._id;

  const videoFilePath = req.files?.videoFile[0]?.path;

  if (!videoFilePath) {
    throw new ApiError(404, "Missing video file path");
  }

  const thumbnailFilePath = req.files?.thumbnail[0]?.path;
  if (!thumbnailFilePath) {
    throw new ApiError(404, "Missing image file path");
  }

  const videoFile = await uploadFileOnCloudinary(videoFilePath);
  const thumbnail = await uploadFileOnCloudinary(thumbnailFilePath);

  const video = await Video.create({
    videoFile: {
      public_id: videoFile?.public_id,
      url: videoFile?.secure_url,
    },
    thumbnail: {
      public_id: thumbnail?.public_id,
      url: thumbnail?.secure_url,
    },
    title,
    description,
    owner,
    duration: Number(videoFile.duration.toFixed(2)),
  });

  if (!video) {
    throw new ApiError(400, "Something went while creating a video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { video }, "Video is created successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "video ID is invalid");
  }
  // const video = await Video.findById(videoId);
  const videoExists = await Video.exists({ _id: videoId });

  if (!videoExists) {
    throw new ApiError(404, "Video not found");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },

    {
      $lookup: {
        from: "dislikes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
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
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },

          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
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
              username: 1,
              fullName: 1,
              "avatar.url": 1,
              subscribersCount: 1,
              isSubscribe: 1,
            },
          },
        ],
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
      $project: {
        title: 1,
        description: 1,
        "thumbnail.url": 1,
        "videoFile.url": 1,
        duration: 1,
        views: 1,
        owner: 1,
        likesCount: 1,
        dislikesCount: 1,
        isLiked: 1,
        isDisliked: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(400, "Something went wrong while fetching the video");
  }
  // console.log(video);

  // increment views
  await Video.findByIdAndUpdate(
    videoId,
    {
      $inc: {
        views: 1,
      },
    },
    {
      returnDocument: "after",
    }
  );

  // set this video to watchHistory
  const setWatchHistory = await User.findByIdAndUpdate(
    req.user?._id,

    {
      $addToSet: {
        watchHistory: videoId,
      },
    },
    {
      returnDocument: "after",
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video has been fetch successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const videoExists = await Video.exists({ _id: videoId });

  if (!videoExists) {
    throw new ApiError(404, "Video not found");
  }

  const video = await Video.findOne({
    _id: videoId,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(404, "Video not found or you are not authorized");
  }

  const oldThumbnail = video.thumbnail?.public_id;

  const newThumbnailFilePath = req.file?.path;

  if (!newThumbnailFilePath) {
    throw new ApiError(400, "Invalid or Missing file");
  }

  const newThumbnail = await uploadFileOnCloudinary(newThumbnailFilePath);

  if (!newThumbnail) {
    throw new ApiError(500, "Failed to upload new thumbnail");
  }

  const updatedVideo = await Video.findOneAndUpdate(
    {
      _id: videoId,
      owner: req.user?._id,
    },

    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: newThumbnail.public_id,
          url: newThumbnail.secure_url,
        },
      },
    },

    {
      returnDocument: "after",
    }
  );

  if (!updatedVideo) {
    throw new ApiError(400, "Something went wrong while updating");
  }

  if (oldThumbnail) {
    await deleteOnCloudinary(oldThumbnail);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { updatedVideo },
        "Video has been updated successfully"
      )
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "video ID is invalid");
  }

  const videoExists = await Video.exists({ _id: videoId });

  if (!videoExists) {
    throw new ApiError(404, "Video not found");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video doesn't found or exist");
  }

  const deleteVideo = await Video.findOneAndDelete({
    _id: videoId,
    owner: req.user?._id,
  });

  if (!deleteVideo) {
    throw new ApiError(400, "Failed to delete video");
  }
  // also delete thumbnail and video from cloudinary
  await deleteOnCloudinary(video.videoFile.public_id, "video");

  await deleteOnCloudinary(video.thumbnail.public_id);

  await Like.deleteMany({
    video: videoId,
  });

  await Dislike.deleteMany({
    video: videoId,
  });

  await Comment.deleteMany({
    video: videoId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video has been deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "video ID is invalid");
  }

  const video = await Video.findOne({
    _id: videoId,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(404, "Video not found or you are not authorized");
  }

  const status = video.isPublished;
  // console.log("Status :", status);
  video.isPublished = !status;
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { video }, "Publish status is toggled"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};

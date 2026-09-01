import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if ([name, description].some((field) => field?.trim() == "")) {
    throw new ApiError(400, "Invalid input details or all fields are required");
  }
  //TODO: create playlist
  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });

  if (!playlist) {
    throw new ApiError(400, "Something went while creating a playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "playlist has been created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const usersPlaylist = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },

    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },

        totalViews: {
          $sum: "$videos.views",
        },

        video: {
          $first: "$videos",
        },
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
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        video: {
          "thumbnail.url": 1,
        },
        totalVideos: 1,
        totalViews: 1,
        updatedAt: 1,
      },
    },
  ]);

  // const userPlaylists = await Playlist.find({
  //   owner: userId,
  // });

  return res
    .status(200)
    .json(
      new ApiResponse(200, usersPlaylist, "fetched user playlists successfully")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //TODO: get playlist by id

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipleline: [
          {
            $match: {
              isPublished: true,
            },
          },
        ],
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
              totalSubscribers: {
                $size: "$subscribers",
              },
            },
          },
        ],
      },
    },

    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },

        totalViews: {
          $sum: "$videos.views",
        },

        owner: {
          $first: "$owner",
        },
      },
    },

    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          totalSubscribers: 1,
        },
      },
    },
  ]);

  // const playlist = await Playlist.findById(playlistId);

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "A playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const updatedPlaylist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user?._id,
    },
    {
      $addToSet: {
        videos: videoId,
      },
    },

    {
      returnDocument: "after",
    }
  );

  if (!updatedPlaylist) {
    throw new ApiError(400, "Invalid playlist id or playlist is not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Playlist has been updated successfully"
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  // TODO: remove video from playlist

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const removeVideo = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user?._id,
    },
    {
      $pull: {
        videos: videoId,
      },
    },

    {
      returnDocument: "after",
    }
  );

  if (!removeVideo) {
    throw new ApiError(
      400,
      "The playlist id is invalid or Video has'nt been found in the playlist"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video has been removed from the playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  // TODO: delete playlist

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const deletedPlaylist = await Playlist.findOneAndDelete({
    _id: playlistId,
    owner: req.user?._id,
  });

  if (!deletedPlaylist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist has been deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  //TODO: update playlist
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user?._id,
    },

    {
      $set: {
        name,
        description,
      },
    },

    {
      returnDocument: "after",
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Playlist has been updated successfully")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};

using System;
using UnityEngine;

namespace Gridline.Native
{
    [Serializable]
    public sealed class GridlineTrackPoint
    {
        public float x;
        public float y;
        public float z;

        public Vector3 ToUnityPosition()
        {
            return new Vector3(x, y, z);
        }
    }

    [Serializable]
    public sealed class GridlineTrackData
    {
        public string id;
        public string name;
        public string source;
        public float halfWidth;
        public float lengthMeters;
        public GridlineTrackPoint[] points;

        public static GridlineTrackData Load(string resourcePath)
        {
            TextAsset asset = Resources.Load<TextAsset>(resourcePath);
            if (asset == null)
            {
                Debug.LogError($"Gridline track data missing: Resources/{resourcePath}.json");
                return null;
            }

            GridlineTrackData track = JsonUtility.FromJson<GridlineTrackData>(asset.text);
            if (track == null || track.points == null || track.points.Length < 4)
            {
                Debug.LogError($"Gridline track data invalid: {resourcePath}");
                return null;
            }

            return track;
        }

        public Vector3 Point(int index)
        {
            int wrapped = (index % points.Length + points.Length) % points.Length;
            return points[wrapped].ToUnityPosition();
        }

        public Vector3 Forward(int index)
        {
            return (Point(index + 1) - Point(index - 1)).normalized;
        }
    }
}

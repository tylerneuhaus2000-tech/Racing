using System;
using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(-50)]
    public sealed class GridlineLapSystem : MonoBehaviour
    {
        public GridlineVehicleController Vehicle;
        public GridlineTrackData Track;
        public int CompletedLaps { get; private set; }
        public int ValidCompletedLaps { get; private set; }
        public int InvalidCompletedLaps { get; private set; }
        public float LapProgress { get; private set; }
        public float TrackDistance { get; private set; }
        public bool IsValidLap { get; private set; } = true;
        public float CurrentLapTime { get; private set; }
        public float LastLapTime { get; private set; }
        public float BestLapTime { get; private set; }
        public int CurrentSector { get; private set; } = 1;
        public float CurrentSectorTime { get; private set; }
        public float[] LastSectorTimes { get; } = { 0f, 0f, 0f };
        public bool IsWrongWay { get; private set; }
        public int NextCheckpoint { get; private set; } = 1;
        public string InvalidReason { get; private set; } = string.Empty;
        public float InvalidProgress { get; private set; }
        public bool LastLapWasValid { get; private set; }
        public string LastCompletedLapInvalidReason { get; private set; } = string.Empty;

        private const int CheckpointCount = 12;
        private float previousProgress;
        private bool armed;
        private bool hasInitialSample;
        private bool hasPositionSample;
        private Vector3 previousVehiclePosition;
        private float lapTravelDistance;
        private float wrongWayTime;
        private float nextCheckpointDiagnosticTime;

        public void Configure(GridlineVehicleController vehicle, GridlineTrackData track)
        {
            Vehicle = vehicle;
            Track = track;
            ResetSession();
        }

        public void ResetSession()
        {
            CompletedLaps = 0;
            ValidCompletedLaps = 0;
            InvalidCompletedLaps = 0;
            LapProgress = 0f;
            TrackDistance = 0f;
            IsValidLap = true;
            CurrentLapTime = 0f;
            LastLapTime = 0f;
            BestLapTime = 0f;
            CurrentSector = 1;
            CurrentSectorTime = 0f;
            IsWrongWay = false;
            NextCheckpoint = 1;
            InvalidReason = string.Empty;
            InvalidProgress = 0f;
            LastLapWasValid = false;
            LastCompletedLapInvalidReason = string.Empty;
            previousProgress = 0f;
            armed = false;
            hasInitialSample = false;
            hasPositionSample = false;
            previousVehiclePosition = Vector3.zero;
            lapTravelDistance = 0f;
            wrongWayTime = 0f;
            nextCheckpointDiagnosticTime = 0f;
            for (int i = 0; i < LastSectorTimes.Length; i += 1) LastSectorTimes[i] = 0f;
        }

        // Restart only the active lap. Session totals and the best lap remain
        // available for the results screen, while timing/checkpoint state
        // starts cleanly from the reset position.
        public void RestartCurrentLap()
        {
            LapProgress = Vehicle != null ? Vehicle.TrackProgress : 0f;
            TrackDistance = Vehicle != null ? Vehicle.TrackDistance : 0f;
            IsValidLap = true;
            CurrentLapTime = 0f;
            CurrentSector = 1;
            CurrentSectorTime = 0f;
            IsWrongWay = false;
            NextCheckpoint = 1;
            InvalidReason = string.Empty;
            InvalidProgress = 0f;
            LastLapWasValid = false;
            LastCompletedLapInvalidReason = string.Empty;
            previousProgress = LapProgress;
            hasInitialSample = true;
            hasPositionSample = Vehicle != null;
            previousVehiclePosition = Vehicle != null ? Vehicle.transform.position : Vector3.zero;
            lapTravelDistance = 0f;
            wrongWayTime = 0f;
            armed = false;
            nextCheckpointDiagnosticTime = 0f;
        }

        private void FixedUpdate()
        {
            if (!GridlineGameState.IsDriving || Vehicle == null || Track == null) return;
            if (GridlineRuntimeBuilder.Race != null
                && GridlineRuntimeBuilder.Race.Enabled
                && !GridlineRuntimeBuilder.Race.IsRaceLive) return;
            if (GridlineRuntimeBuilder.TimeTrial != null
                && GridlineRuntimeBuilder.TimeTrial.IsManualCountdown) return;

            GridlineTrackData.Sample sample = Track.Query(Vehicle.transform.position, Vehicle.TrackSampleIndex);
            float progress = sample.progress;
            LapProgress = progress;
            TrackDistance = sample.distance;
            CurrentLapTime += Time.fixedDeltaTime;
            CurrentSectorTime += Time.fixedDeltaTime;

            Vector3 currentVehiclePosition = Vehicle.transform.position;
            if (!hasPositionSample)
            {
                previousVehiclePosition = currentVehiclePosition;
                hasPositionSample = true;
            }
            else
            {
                Vector3 movement = currentVehiclePosition - previousVehiclePosition;
                lapTravelDistance += movement.magnitude;
                UpdateWrongWay(sample, movement);
                ProcessCheckpointCrossing(previousVehiclePosition, currentVehiclePosition,
                    previousProgress, progress);
                previousVehiclePosition = currentVehiclePosition;
            }

            if (Mathf.Abs(sample.lateral) > Track.halfWidth + 1.5f)
                MarkInvalid("track_limits", progress);

            if (!hasInitialSample)
            {
                previousProgress = progress;
                hasInitialSample = true;
                return;
            }

            previousProgress = progress;
        }

        private void UpdateWrongWay(GridlineTrackData.Sample sample, Vector3 movement)
        {
            Vector3 flatMovement = Vector3.ProjectOnPlane(movement, Vector3.up);
            if (flatMovement.sqrMagnitude < 0.01f) return;

            float direction = Vector3.Dot(flatMovement.normalized, sample.forward);
            if (Vehicle.SpeedKph > 18f && direction < -0.45f)
            {
                wrongWayTime += Time.fixedDeltaTime;
                if (wrongWayTime > 1.5f)
                {
                    IsWrongWay = true;
                    MarkInvalid("wrong_way", sample.progress);
                }
            }
            else
            {
                wrongWayTime = Mathf.Max(0f, wrongWayTime - Time.fixedDeltaTime * 2f);
                if (wrongWayTime <= 0.001f) IsWrongWay = false;
            }
        }

        private void ProcessCheckpointCrossing(Vector3 previousPosition, Vector3 currentPosition,
            float previousSampleProgress, float currentSampleProgress)
        {
            if (!CrossedCheckpoint(previousPosition, currentPosition, NextCheckpoint,
                previousSampleProgress, currentSampleProgress)) return;

            int crossedCheckpoint = NextCheckpoint;
            NextCheckpoint = (NextCheckpoint + 1) % CheckpointCount;
            Debug.Log($"Gridline lap checkpoint {crossedCheckpoint} crossed; next={NextCheckpoint}");
            if (crossedCheckpoint == 1) armed = true;

            if (crossedCheckpoint == 4)
            {
                LastSectorTimes[0] = CurrentSectorTime;
                CurrentSector = 2;
                CurrentSectorTime = 0f;
            }
            else if (crossedCheckpoint == 8)
            {
                LastSectorTimes[1] = CurrentSectorTime;
                CurrentSector = 3;
                CurrentSectorTime = 0f;
            }
            else if (crossedCheckpoint == 0 && armed)
            {
                CompleteLap();
            }
        }

        private bool CrossedCheckpoint(Vector3 previousPosition, Vector3 currentPosition, int checkpoint,
            float previousSampleProgress, float currentSampleProgress)
        {
            float threshold = checkpoint / (float)CheckpointCount;
            bool wrapped = previousSampleProgress > 0.90f && currentSampleProgress < 0.10f;
            bool progressCrossed = checkpoint == 0
                ? wrapped
                : previousSampleProgress <= currentSampleProgress
                    ? previousSampleProgress < threshold && currentSampleProgress >= threshold
                    : wrapped && currentSampleProgress >= threshold;

            int index = Mathf.RoundToInt(checkpoint / (float)CheckpointCount * (Track.points.Length - 1));
            Vector3 point = Track.Point(index);
            Vector3 forward = Track.Forward(index);
            Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;
            float before = Vector3.Dot(previousPosition - point, forward);
            float after = Vector3.Dot(currentPosition - point, forward);
            Vector3 midpoint = (previousPosition + currentPosition) * 0.5f;
            float lateral = Mathf.Abs(Vector3.Dot(midpoint - point, side));
            bool geometryCrossed = before < -0.05f && after >= 0f
                && lateral <= Track.halfWidth + 3f;

            if (checkpoint == 11 && HasArgument("-gridline-qa-race")
                && Time.unscaledTime >= nextCheckpointDiagnosticTime)
            {
                nextCheckpointDiagnosticTime = Time.unscaledTime + 1f;
                Debug.Log($"Gridline lap checkpoint diagnostic checkpoint=11 "
                    + $"progress={previousSampleProgress:0.000}->{currentSampleProgress:0.000} "
                    + $"threshold={threshold:0.000} before={before:0.00} after={after:0.00} "
                    + $"lateral={lateral:0.00} limit={Track.halfWidth + 3f:0.00} "
                    + $"progressCrossed={progressCrossed} geometryCrossed={geometryCrossed}");
            }

            return progressCrossed || geometryCrossed;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        private void CompleteLap()
        {
            // A real distance floor prevents a start-line oscillation from
            // completing a lap despite checkpoint ordering.
            if (lapTravelDistance < Track.lengthMeters * 0.72f) return;

            bool completedValid = IsValidLap;
            string completedInvalidReason = completedValid ? string.Empty : InvalidReason;
            CompletedLaps += 1;
            if (completedValid) ValidCompletedLaps += 1;
            else InvalidCompletedLaps += 1;
            LastLapTime = CurrentLapTime;
            LastSectorTimes[2] = CurrentSectorTime;
            LastLapWasValid = completedValid;
            LastCompletedLapInvalidReason = completedInvalidReason;
            if (completedValid && (BestLapTime <= 0f || LastLapTime < BestLapTime)) BestLapTime = LastLapTime;
            CurrentLapTime = 0f;
            lapTravelDistance = 0f;
            CurrentSector = 1;
            CurrentSectorTime = 0f;
            IsValidLap = true;
            IsWrongWay = false;
            InvalidReason = string.Empty;
            InvalidProgress = 0f;
            wrongWayTime = 0f;
            Debug.Log($"Gridline lap completed #{CompletedLaps}: {LastLapTime:0.000}s "
                + $"valid={completedValid} rule={(completedValid ? "none" : completedInvalidReason)} "
                + $"validCount={ValidCompletedLaps} invalidCount={InvalidCompletedLaps}");
        }

        private void MarkInvalid(string reason, float progress)
        {
            if (!IsValidLap) return;
            IsValidLap = false;
            InvalidReason = reason;
            InvalidProgress = progress;
            Debug.Log($"Gridline lap invalidated rule=LAP_VALIDATION reason={reason} "
                + $"progress={progress * 100f:0.0}% lateral={Vehicle.TrackLateral:0.0} "
                + $"halfWidth={Track.halfWidth:0.0}");
        }
    }
}

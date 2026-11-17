using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    public enum GridlineRacePhase
    {
        Disabled,
        Grid,
        Countdown,
        Live,
        Finished
    }

    // Race orchestration stays separate from the vehicle model and lap rules.
    // The player and AI use the same Rigidbody controller; this component only
    // owns the session clock, order, finish and result state.
    [DefaultExecutionOrder(-20)]
    public sealed class GridlineRaceSession : MonoBehaviour
    {
        private readonly List<GridlineAiDriver> aiDrivers = new List<GridlineAiDriver>();
        private float countdownElapsed;
        private float raceElapsed;
        private float nextStandingsLog;
        private float playerFinishTime = -1f;
        private float finishWaitElapsed;
        private bool raceQa;
        private bool playerFinishLogged;
        private bool resultLogged;
        private bool playerTimeoutLogged;

        public GridlineVehicleController Player { get; private set; }
        public GridlineTrackData Track { get; private set; }
        public GridlineLapSystem PlayerLaps { get; private set; }
        public GridlineRacePhase Phase { get; private set; } = GridlineRacePhase.Disabled;
        public int RaceLaps { get; private set; } = 3;
        public int DesiredAiCount { get; private set; } = 2;
        public bool Enabled { get; private set; }
        public bool IsRaceLive => Enabled && Phase == GridlineRacePhase.Live;
        public string ModeLabel => Enabled ? "RACE" : "TIME TRIAL";
        public int PlayerPosition { get; private set; } = 1;
        public int ParticipantCount => 1 + aiDrivers.Count;
        public float GapToLeaderMeters { get; private set; }
        public string ResultSummary { get; private set; } = string.Empty;

        // QA elapsed time represents simulated race time. A sleeping or
        // backgrounded macOS process can report a very large unscaled delta
        // when it resumes; that must not turn a healthy active lap into a
        // synthetic finish-timeout.
        private static float SimulationDeltaTime => Mathf.Clamp(
            Time.unscaledDeltaTime, 0f, 0.25f);

        public void Configure(GridlineVehicleController player, GridlineTrackData track,
            GridlineLapSystem playerLaps)
        {
            Player = player;
            Track = track;
            PlayerLaps = playerLaps;
            Enabled = HasArgument("-gridline-race") || HasArgument("-gridline-qa-race");
            raceQa = HasArgument("-gridline-qa-race");
            string lapArgument = raceQa ? "-gridline-qa-race-laps=" : "-gridline-race-laps=";
            int defaultLaps = raceQa ? 1 : 3;
            RaceLaps = Mathf.Clamp(ReadIntArgument(lapArgument, defaultLaps), 1, 99);
            DesiredAiCount = Mathf.Clamp(ReadIntArgument("-gridline-race-ai=", 2), 1, 6);
            Phase = Enabled ? GridlineRacePhase.Grid : GridlineRacePhase.Disabled;
            if (Enabled)
            {
                Debug.Log($"Gridline race configured mode={(raceQa ? "QA" : "PLAYER")} "
                    + $"laps={RaceLaps} ai={DesiredAiCount} track={Track?.name ?? "unknown"}");
            }
        }

        public void RegisterAi(GridlineAiDriver ai)
        {
            if (ai != null && !aiDrivers.Contains(ai)) aiDrivers.Add(ai);
        }

        private void Update()
        {
            if (!Enabled || Player == null || PlayerLaps == null) return;

            if (Phase == GridlineRacePhase.Grid && GridlineGameState.IsDriving)
            {
                Phase = GridlineRacePhase.Countdown;
                countdownElapsed = 0f;
                Debug.Log("Gridline race countdown 3");
            }

            if (Phase == GridlineRacePhase.Countdown)
            {
                countdownElapsed += SimulationDeltaTime;
                int remaining = Mathf.CeilToInt(3f - countdownElapsed);
                if (remaining > 0 && remaining < 4 && Time.unscaledTime >= nextStandingsLog)
                {
                    nextStandingsLog = Time.unscaledTime + 1f;
                    Debug.Log($"Gridline race countdown {remaining}");
                }
                if (countdownElapsed >= 3f)
                {
                    Phase = GridlineRacePhase.Live;
                    raceElapsed = 0f;
                    nextStandingsLog = 0f;
                    Debug.Log($"Gridline race GREEN track={Track?.name ?? "unknown"}");
                }
                return;
            }

            if (Phase != GridlineRacePhase.Live) return;
            raceElapsed += SimulationDeltaTime;
            UpdateStandings();
            if (Time.unscaledTime >= nextStandingsLog)
            {
                nextStandingsLog = Time.unscaledTime + 5f;
                Debug.Log($"Gridline race standings playerPos={PlayerPosition}/{ParticipantCount} "
                    + $"playerProgress={PlayerRaceProgress:0.000} gapMeters={GapToLeaderMeters:0.0} "
                    + $"elapsed={raceElapsed:0.0}s");
            }

            // A QA race must terminate on a bounded wall clock so an invalid
            // gate or driver failure cannot leave a headless run alive forever.
            // This does not make a lap valid; it only records the failure class.
            float playerTimeout = Mathf.Max(420f, RaceLaps * 360f + 60f);
            if (raceQa && playerFinishTime < 0f && raceElapsed > playerTimeout)
            {
                FailQaPlayerTimeout();
                return;
            }

            if (playerFinishTime < 0f && PlayerLaps.ValidCompletedLaps >= RaceLaps)
            {
                playerFinishTime = raceElapsed;
                Player.ClearDriverInput();
                if (!playerFinishLogged)
                {
                    playerFinishLogged = true;
                    Debug.Log($"Gridline race player finished laps={RaceLaps} "
                        + $"time={playerFinishTime:0.000}s position={PlayerPosition}/{ParticipantCount}");
                }
            }

            if (playerFinishTime >= 0f)
            {
                finishWaitElapsed += SimulationDeltaTime;
                bool allAiFinished = aiDrivers.TrueForAll(ai => ai.CompletedLaps >= RaceLaps);
                if (allAiFinished || finishWaitElapsed >= 30f)
                {
                    FinishRace(allAiFinished);
                }
            }
        }

        private float PlayerRaceProgress => PlayerLaps.CompletedLaps + PlayerLaps.LapProgress;

        private void UpdateStandings()
        {
            float playerProgress = PlayerRaceProgress;
            int position = 1;
            float leaderProgress = playerProgress;
            for (int i = 0; i < aiDrivers.Count; i += 1)
            {
                float progress = aiDrivers[i].RaceProgress;
                if (progress > playerProgress + 0.0001f) position += 1;
                leaderProgress = Mathf.Max(leaderProgress, progress);
            }
            PlayerPosition = Mathf.Clamp(position, 1, ParticipantCount);
            GapToLeaderMeters = Mathf.Max(0f, leaderProgress - playerProgress) * Track.lengthMeters;
        }

        private void FinishRace(bool allAiFinished)
        {
            if (resultLogged) return;
            resultLogged = true;
            Phase = GridlineRacePhase.Finished;
            UpdateStandings();
            string aiStatus = allAiFinished ? "all_ai_finished" : "ai_timeout";
            ResultSummary = $"P{PlayerPosition}/{ParticipantCount} {playerFinishTime:0.000}s {aiStatus}";
            Debug.Log($"Gridline race result position={PlayerPosition}/{ParticipantCount} "
                + $"playerTime={playerFinishTime:0.000}s laps={RaceLaps} "
                + $"aiFinished={CountFinishedAi()}/{aiDrivers.Count} status={aiStatus} "
                + $"aiContactLossEvents={CountAiContactLossEvents()} "
                + $"aiResets={CountAiResets()}");

            if (raceQa)
            {
                if (allAiFinished)
                {
                    Debug.Log($"Gridline race QA PASS position={PlayerPosition}/{ParticipantCount} "
                        + $"laps={RaceLaps} aiFinished={CountFinishedAi()} "
                        + $"aiContactLossEvents={CountAiContactLossEvents()} aiResets={CountAiResets()}");
                    Application.Quit(0);
                }
                else
                {
                    Debug.LogError("Gridline race QA failure class=AI_DRIVER reason=finish_timeout "
                        + $"completed={CountFinishedAi()}/{aiDrivers.Count}");
                    Application.Quit(1);
                }
            }
        }

        private void FailQaPlayerTimeout()
        {
            if (playerTimeoutLogged || resultLogged) return;
            playerTimeoutLogged = true;
            resultLogged = true;
            Phase = GridlineRacePhase.Finished;
            string failureClass = PlayerLaps.InvalidReason.Length > 0
                || PlayerLaps.NextCheckpoint != 0 ? "LAP_VALIDATION" : "QA_DRIVER";
            Debug.LogError($"Gridline race QA failure class={failureClass} "
                + $"reason=player_finish_timeout elapsed={raceElapsed:0.000}s "
                + $"progress={PlayerRaceProgress:0.000} nextCheckpoint={PlayerLaps.NextCheckpoint} "
                + $"invalidReason={PlayerLaps.InvalidReason} validLaps={PlayerLaps.ValidCompletedLaps}");
            Application.Quit(1);
        }

        private int CountFinishedAi()
        {
            int count = 0;
            for (int i = 0; i < aiDrivers.Count; i += 1)
                if (aiDrivers[i].CompletedLaps >= RaceLaps) count += 1;
            return count;
        }

        private int CountAiContactLossEvents()
        {
            int count = 0;
            for (int i = 0; i < aiDrivers.Count; i += 1) count += aiDrivers[i].ContactLossEvents;
            return count;
        }

        private int CountAiResets()
        {
            int count = 0;
            for (int i = 0; i < aiDrivers.Count; i += 1) count += aiDrivers[i].RecoveryResetCount;
            return count;
        }

        private static int ReadIntArgument(string prefix, int fallback)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
            {
                if (!args[i].StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
                if (int.TryParse(args[i].Substring(prefix.Length), out int value)) return value;
            }
            return fallback;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}

# Reference campaign levels 1–11

Evidence review dated 2026-10-08. The source video is `docs/knowledge/white-tower/source-video.mp4`; the available extracted frames are R01–R12 in `docs/knowledge/white-tower/references/`. The video file itself could not be played in the available environment, so this record distinguishes static-frame observations from reconstructed details. This is not an owner acceptance of the visual slice.

## Coordinate convention and evidence

Level JSON uses logical `u,v` coordinates and the direction vocabulary from the GDD. Static images show an isometric projection, but the handedness/projection remains unresolved in `docs/decisions/renderer.md`. Coordinates below are data coordinates, not pixel measurements. Where a screenshot does not expose every cell or arrow clearly, the entry is explicitly approximate and must be revisited during visual calibration.

The GDD reports white-tile counts by level as 4, 5, 4, 7, 8, 14, 5, 5, 13, 9, 12. Frame associations: Lv.1 R01 (0s), collection R02 (1.5s); Lv.2 R03 (4.4s); Lv.3 R04 (8.5s); Lv.4 R05 (13s); Lv.6 R06 (23s); high tower after collection R07 (33s); Lv.7 R08 (35s); Lv.9 R09 (57s); Lv.11 start R10 (81s), intermediate R11 (101s), victory R12 (113s).

## Level records

| Level | Tiles | Frame / timestamp | Layout confidence | Notes |
| --- | ---: | --- | --- | --- |
| 1 | 4 | R01 / 0s; R02 / 1.5s | High for count and opening row; medium for projection mapping | The one-row opening and collection outcome align with GDD example A. JSON solution is replayed by the simulator. |
| 2 | 5 | R03 / 4.4s | Medium | Branch shape/count are visible; exact logical handedness follows the still-unresolved projection convention. Opening route matches example B's rule demonstration only where coordinates are shared. |
| 3 | 4 | R04 / 8.5s | Medium | Count and arrangement are visible; exact arrow attribution is less certain than the silhouette. |
| 4 | 7 | R05 / 13s | Medium | Seven tiles visible; coordinate transcription is provisional pending renderer comparison. |
| 5 | 8 | No extracted start frame | Low; approximate reconstruction authorized by owner | Reconstructed as an eight-tile playable layout. No visual claim is made. |
| 6 | 14 | R06 / 23s | Medium for count and dense symmetric silhouette; low for exact arrows | Fourteen-tile cluster recorded; individual redirects and logical coordinates are provisional. |
| 7 | 5 | R08 / 35s; R07 / 33s is post-collection | Medium silhouette; provisional coordinate/arrows | Reconstructed as a five-tile ring with three redirects, top-ring start and a one-move route. R07 is a tall-stack outcome, not a reliable start-state substitute. Revised layout is solver-validated and remains provisional pending TASK-0013. |
| 8 | 5 | No extracted start frame | Low; approximate reconstruction authorized by owner | Reconstructed as a five-tile playable layout. No visual claim is made. |
| 9 | 13 | R09 / 57s | Medium for count; low for exact coordinates/arrows | Dense thirteen-tile shape is visible; JSON includes provisional logical placement and redirect details. |
| 10 | 9 | No extracted start frame | Low; approximate reconstruction authorized by owner | Reconstructed as a nine-tile playable layout. No visual claim is made. |
| 11 | 12 | R10 / 81s, R11 / 101s, R12 / 113s | Medium for start count; low-to-medium for transition details | R10 shows the twelve-tile start. R11 visibly shows a four-tile intermediate stack plus empty floor; the exact event sequence was not verified by video playback. R12 shows the victory state. |

## Solutions and validation

Every JSON level includes a `knownSolution`. It is a mechanically replayable solution under the current simulator and is distinct from a video-observed move sequence. Automated tests validate each level, replay all solutions to one stack, and verify the catalog checksum and error handling. Because the video was not directly played, none of the `knownSolution` arrays should be cited as proof of the original video's exact input sequence.

The user explicitly authorized approximate reconstructions for Lv.5, Lv.8, and Lv.10 because their start frames are absent. Other uncertain coordinates/arrows are labeled provisional above; they should be compared with the video during TASK-0013 visual calibration before owner acceptance.

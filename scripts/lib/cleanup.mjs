// For `.catch()` on proof/test cleanup steps: a swallowed error would leave test users or changed
// rows behind unnoticed, so report it and make the run exit non-zero.
export function cleanupFailed(error) {
  console.error(`[cleanup failed] ${error?.message ?? error}`);
  process.exitCode = 1;
}

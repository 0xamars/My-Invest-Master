/** Sign out, then always send the user to signed-out marketing `/`. */
export async function signOutThenGoHome(
  signOut: () => Promise<void>,
  goHome: () => void,
): Promise<void> {
  try {
    await signOut();
  } finally {
    goHome();
  }
}

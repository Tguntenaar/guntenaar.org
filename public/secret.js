/*
 * One hidden destination per row, revealed by clicking that row's portrait
 * three times. Currently just Thomas's geforcy.com.
 *
 * Driven by [data-secret] in the markup rather than by a hardcoded name, so
 * hiding another link later is a markup change and nothing else.
 */
// Three clicks, at whatever pace. No time window on purpose: requiring them in
// quick succession turns a secret into a reflex test, and someone poking at a
// portrait to see if anything happens deserves to find it.
const NEEDED = 3;
const STORE_KEY = "guntenaar:revealed";

// Once found, it stays found. Re-hiding a link someone has already unlocked —
// and has probably come back to use — would be a puzzle, not a secret.
let unlocked = new Set();
try {
  unlocked = new Set(JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]"));
} catch {}

for (const person of document.querySelectorAll(".person")) {
  const secrets = person.querySelectorAll("[data-secret]");
  const portrait = person.querySelector(".portrait");
  if (!secrets.length || !portrait) continue;

  const id = portrait.getAttribute("src");

  if (unlocked.has(id)) {
    secrets.forEach((el) => el.removeAttribute("hidden"));
    continue;
  }

  let count = 0;

  portrait.addEventListener("click", () => {
    count += 1;
    if (count < NEEDED) return;

    secrets.forEach((el) => {
      el.removeAttribute("hidden");
      el.classList.add("is-revealed");
    });

    unlocked.add(id);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...unlocked]));
    } catch {}
  });
}

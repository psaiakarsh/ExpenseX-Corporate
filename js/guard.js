// guard.js — page protection. Runs before any signed-in page draws its content.
//
//   not logged in / deactivated → login page
//   wrong role                  → the user's own dashboard, with an "Access denied" message
//
// This is real JavaScript enforcement (the page never renders), not just hidden buttons.
// Individual records are protected again by can() inside every action and page.

// Returns the logged-in user when their role is allowed here; otherwise redirects and returns null.
function requireUser(allowedRoles) {
  const user = getSessionUser();
  if (!user) {
    location.replace(appUrl('login.html'));
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    setFlash('Access denied: that page is not available for your role.', 'error');
    location.replace(appUrl(homeFor(user.role)));
    return null;
  }
  return user;
}

// For login / signup / setup: someone already logged in goes straight to their dashboard.
function redirectIfLoggedIn() {
  const user = getSessionUser();
  if (user) {
    location.replace(appUrl(homeFor(user.role)));
    return true;
  }
  return false;
}

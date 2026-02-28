export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type GtagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: string | number | undefined;
};

export function trackEvent({ action, category, label, value, ...rest }: GtagEvent) {
  if (typeof window === "undefined" || !GA_ID) return;
  window.gtag?.("event", action, {
    event_category: category,
    event_label: label,
    value,
    ...rest,
  });
}

// — Auth events
export const gaLogin = (role: string) =>
  trackEvent({ action: "login", category: "auth", label: role });

export const gaLoginFailed = (reason: string) =>
  trackEvent({ action: "login_failed", category: "auth", label: reason });

export const gaLogout = () =>
  trackEvent({ action: "logout", category: "auth" });

// — Vote events
export const gaTeamSelect = (teamId: string, selected: boolean) =>
  trackEvent({ action: "team_select", category: "vote", label: teamId, value: selected ? 1 : 0 });

export const gaTeamInspect = (teamId: string) =>
  trackEvent({ action: "team_inspect", category: "vote", label: teamId });

export const gaVoteConfirmOpen = (count: number) =>
  trackEvent({ action: "vote_confirm_open", category: "vote", value: count });

export const gaVoteSubmit = (count: number, role: string) =>
  trackEvent({ action: "vote_submit", category: "vote", value: count, role });

export const gaVoteFailed = (reason: string) =>
  trackEvent({ action: "vote_failed", category: "vote", label: reason });

// — Engagement events
export const gaCheerSend = (teamId: string, emoji: string) =>
  trackEvent({ action: "cheer_send", category: "engagement", label: `${teamId}:${emoji}` });

export const gaFeedbackSend = (teamId: string, type: string) =>
  trackEvent({ action: "feedback_send", category: "engagement", label: `${teamId}:${type}` });

export const gaFeedbackReply = (teamId: string) =>
  trackEvent({ action: "feedback_reply", category: "engagement", label: teamId });

export const gaChatMessage = () =>
  trackEvent({ action: "chat_message", category: "engagement" });

// — Results events
export const gaResultsView = (phase: string) =>
  trackEvent({ action: "results_view", category: "results", label: phase });

export const gaRevealComplete = (phase: string) =>
  trackEvent({ action: "reveal_complete", category: "results", label: phase });

// — Profile/Team edit events
export const gaProfileEdit = () =>
  trackEvent({ action: "profile_edit", category: "user" });

export const gaTeamEdit = () =>
  trackEvent({ action: "team_edit", category: "user" });

// — Mission events
export const gaMissionPanelOpen = () =>
  trackEvent({ action: "mission_panel_open", category: "engagement" });

// — External link clicks
export const gaExternalLinkClick = (type: string, teamId: string) =>
  trackEvent({ action: "external_link_click", category: "engagement", label: `${type}:${teamId}` });

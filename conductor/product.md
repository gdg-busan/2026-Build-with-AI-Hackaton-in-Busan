# Product Guide

## Initial Concept
**GDG Busan "Build with AI" Hackathon Voting Platform**

A real-time voting system designed to facilitate fair and dramatic voting for 25 hackathon teams to select the TOP 10. The platform features a unique "Living Terminal" aesthetic and manages weighted voting between participants and judges.

## Vision
To provide a seamless, engaging, and transparent voting experience for hackathon participants and judges, ensuring a fair selection process while adding excitement to the event through real-time updates and a dramatic reveal.

## Core Features
- **Authentication**: Code-based login (e.g., `P001`, `J001`) with Firebase Custom Tokens.
- **Voting System**: Weighted voting (Judge: 80%, Participant: 20%).
- **Real-time Updates**: Live vote tracking via Firestore `onSnapshot`.
- **Team Inspection**: Detailed team profiles via "Inspect Sheet".
- **Results Reveal**: Dramatic countdown and sequential reveal of top teams.
- **Admin Dashboard**: Event, team, and user management.

## Target Audience
- **Participants**: Hackathon attendees who vote for other teams.
- **Judges**: Evaluators with weighted voting power.
- **Admins**: Organizers managing the event flow.

## Design Philosophy
- **Living Terminal**: Dark theme (`#0A0E1A`) with terminal green (`#00FF88`), AI blue (`#4DAFFF`), and orange (`#FF6B35`) accents.
- **Interactive**: Glow effects, scanlines, and typing animations.

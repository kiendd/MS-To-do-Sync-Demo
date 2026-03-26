export const GRAPH_SCOPES = [
  "https://graph.microsoft.com/Tasks.ReadWrite",
  "https://graph.microsoft.com/User.Read",
] as const;

export const LOGIN_REQUEST = {
  scopes: [
    "openid",
    "offline_access",
    ...GRAPH_SCOPES,
  ],
};

export const TOKEN_REQUEST = {
  scopes: [...GRAPH_SCOPES],
};

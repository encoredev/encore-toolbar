import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import log from "encore.dev/log";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
  role: string;
}

const VALID_TOKENS: Record<string, AuthData> = {
  "Bearer test-token-alice": { userID: "alice", role: "admin" },
  "Bearer test-token-bob": { userID: "bob", role: "editor" },
};

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const data = VALID_TOKENS[params.authorization];
  if (!data) {
    log.warn("authentication failed", { token_prefix: params.authorization.slice(0, 10) + "..." });
    throw APIError.unauthenticated("invalid token");
  }
  log.info("user authenticated", { userID: data.userID, role: data.role });
  return data;
});

export const gateway = new Gateway({
  authHandler: auth,
});

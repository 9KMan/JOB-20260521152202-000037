import * as jose from 'jose';

interface TokenPayload {
  sub: string;
  client_id: string;
  scopes: string[];
  exp: number;
  iat: number;
}

// Simulated authorization server for demo
// In production, this would integrate with a real OAuth 2.1 server
export class AuthMiddleware {
  private issuer = 'https://auth.example.com';
  private audience = 'mcp-server';
  private clients: Map<string, { secret: string; scopes: string[] }> = new Map([
    ['demo-client', { secret: 'demo-secret', scopes: ['tools:read', 'tools:write', 'resources:read'] }],
  ]);
  private tokens: Map<string, TokenPayload> = new Map();
  private signingKey: jose.KeyLike;

  constructor() {
    // Generate a demo signing key
    this.signingKey = jose.generateSecret('HS256');
  }

  // Generate authorization URL with PKCE
  getAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
    const codeVerifier = jose.base64url.encode(crypto.randomBytes(32));
    const codeChallenge = jose.base64url.encode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: this.clients.get(clientId)?.scopes.join(' ') || 'tools:read',
    });
    
    return `${this.issuer}/authorize?${params}`;
  }

  // Exchange code for tokens (simplified)
  async exchangeCode(clientId: string, code: string): Promise<string> {
    const accessToken = await new jose.SignJWT({ sub: clientId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setAudience(this.audience)
      .setIssuer(this.issuer)
      .sign(this.signingKey);

    const payload: TokenPayload = {
      sub: clientId,
      client_id: clientId,
      scopes: this.clients.get(clientId)?.scopes || [],
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
    };
    this.tokens.set(accessToken, payload);
    return accessToken;
  }

  // Verify token and extract payload
  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.signingKey, {
        audience: this.audience,
        issuer: this.issuer,
      });
      return payload as unknown as TokenPayload;
    } catch {
      return null;
    }
  }

  getScopes(clientId: string): string[] {
    return this.clients.get(clientId)?.scopes || [];
  }

  hasScope(clientId: string, scope: string): boolean {
    return this.getScopes(clientId).includes(scope);
  }
}
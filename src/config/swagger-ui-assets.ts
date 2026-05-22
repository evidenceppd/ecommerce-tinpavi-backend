type SwaggerUiDistModule = {
  getAbsoluteFSPath?: () => string;
  absolutePath?: () => string;
};

export function resolveSwaggerUiAssetsPath(): string {
  const swaggerUiDist = require('swagger-ui-dist') as SwaggerUiDistModule;

  if (typeof swaggerUiDist.getAbsoluteFSPath === 'function') {
    return swaggerUiDist.getAbsoluteFSPath();
  }

  if (typeof swaggerUiDist.absolutePath === 'function') {
    return swaggerUiDist.absolutePath();
  }

  throw new Error('Unable to resolve swagger-ui-dist assets path');
}

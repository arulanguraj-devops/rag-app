/**
 * Version utility for the application
 * Create React App 5+ supports direct import from package.json
 */
import packageJson from '../../package.json';

export const getAppVersion = () => {
  return packageJson.version;
};
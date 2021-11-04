declare module "*.svg" {
  const content: any;
  export default content;
}

declare module "*.png" {
  const content: any;
  export default content;
}

declare interface IPlugin {
  isOffShelf: boolean;
  onLoaded: () => void;
  onRouteChange: (prevPathname: string, currentPathname: string) => void;
}

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

@interface RCT_EXTERN_MODULE(NativeVideoViewModule, NSObject)

RCT_EXTERN_METHOD(pauseEmbedded:(NSString *)urlString)
RCT_EXTERN_METHOD(presentFullscreen:(NSString *)urlString)
RCT_EXTERN_METHOD(closeFullscreen)

@end

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(NativeVideoViewManager, RCTViewManager)

RCT_EXTERN_METHOD(setSource:(nonnull NSNumber *)reactTag source:(NSDictionary *)source)
RCT_EXTERN_METHOD(setPaused:(nonnull NSNumber *)reactTag paused:(BOOL)paused)
RCT_EXTERN_METHOD(setRepeat:(nonnull NSNumber *)reactTag repeatVideo:(BOOL)repeatVideo)
RCT_EXTERN_METHOD(setThumbnail:(nonnull NSNumber *)reactTag thumbnail:(NSString *)thumbnail)

@end

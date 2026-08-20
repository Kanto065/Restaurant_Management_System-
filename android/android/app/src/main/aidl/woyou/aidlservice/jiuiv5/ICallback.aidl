package woyou.aidlservice.jiuiv5;

// Sunmi's published callback interface for the printer service - matches
// woyou.aidlservice.jiuiv5.ICallback from Sunmi's official InnerPrinter SDK docs.
interface ICallback {
    oneway void onRunResult(boolean isSuccess);
    oneway void onReturnString(String result);
    oneway void onRaiseException(int code, String msg);
    oneway void onPrintResult(int code, String msg);
}

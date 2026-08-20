package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;

// Sunmi's published InnerPrinter AIDL interface (package/method names are fixed by Sunmi's
// SDK, not ours to rename) - the system-bound service every Sunmi terminal (including the V2)
// exposes for driving its built-in thermal printer. Bound via the "woyou.aidlservice.jiuiv5.IWoyouService"
// intent action, see SunmiPrinterPlugin.
interface IWoyouService {
    void printerInit(ICallback callback);
    void printerSelfChecking(ICallback callback);
    int updatePrinterState();
    String getPrinterSerialNo();
    String getPrinterVersion();
    String getPrinterPaper();
    String getPrinterModal();

    void setPrinterStyle(int key, int value);
    void setAlignment(int alignment, ICallback callback);
    void setFontName(String typeface, ICallback callback);
    void setFontSize(float fontsize, ICallback callback);

    void printText(String text, ICallback callback);
    void printTextWithFont(String text, String typeface, float fontsize, ICallback callback);
    void printOriginalText(String text, ICallback callback);
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, ICallback callback);

    void printBarCode(String data, int symbology, int height, int width, int textposition, ICallback callback);
    void printQRCode(String data, int modulesize, int errorlevel, ICallback callback);
    void printBitmap(in Bitmap bitmap, ICallback callback);

    void lineWrap(int n, ICallback callback);
    void cutPaper(ICallback callback);

    void sendRAWData(in byte[] data, ICallback callback);

    void enterPrinterBuffer(boolean clean);
    void exitPrinterBuffer(boolean commit);
    void commitPrinterBuffer();
    void clearPrinterBuffer();
}

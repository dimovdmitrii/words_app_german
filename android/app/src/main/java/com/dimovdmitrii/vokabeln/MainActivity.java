package com.dimovdmitrii.vokabeln;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Task switcher / some launchers read activity title from resources
    setTitle(R.string.app_name);
    // Pixel / gesture nav: let WebView extend into system bar insets so JS innerHeight matches the visible area.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.parseColor("#0f172a"));
  }
}

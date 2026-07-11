package com.algeriatech.basta

import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val context = LocalContext.current

            // Mémorise le moment du dernier appui sur « retour » (double-appui pour quitter)
            var lastBackTime by remember { mutableStateOf(0L) }

            val webView = remember {
                WebView(context).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    // Toujours privilégier le réseau : l'app reflète les mises à jour
                    // du site (le Service Worker du site gère le mode hors-ligne).
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    loadUrl("https://algeria-tech.pages.dev/")
                }
            }

            // Bouton retour : recule dans l'historique web, sinon double-appui pour quitter
            BackHandler(enabled = true) {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastBackTime < 2000) {
                        (context as? Activity)?.finish()
                    } else {
                        Toast.makeText(context, "Appuyez encore pour quitter", Toast.LENGTH_SHORT).show()
                        lastBackTime = currentTime
                    }
                }
            }

            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { webView }
            )
        }
    }
}

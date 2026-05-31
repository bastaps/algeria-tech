package com.algeriatech.basta

<<<<<<< HEAD
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
<<<<<<< Updated upstream
=======
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
>>>>>>> 5896176 (Sauvegarde complète locale avant synchronisation)
=======
>>>>>>> Stashed changes
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
<<<<<<< Updated upstream
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
            // C'est ici qu'on crée la vue web
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        // Configuration pour que le site s'affiche bien
                        settings.javaScriptEnabled = true
<<<<<<< Updated upstream
                        settings.domStorageEnabled = true
=======
>>>>>>> Stashed changes
                        webViewClient = WebViewClient()

                        // REMPLACEZ PAR L'ADRESSE DE VOTRE SITE :
                        loadUrl("https://algeria-tech.pages.dev/")
                    }
<<<<<<< Updated upstream
                }
=======
            val context = LocalContext.current

            // Variable pour mémoriser le temps du dernier appui sur retour
            var lastBackTime by remember { mutableStateOf(0L) }

            // Initialisation de la WebView avec les paramètres optimisés
            val webView = remember {
                WebView(context).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    loadUrl("https://algeria-tech.pages.dev/")
                }
            }

            // GESTION DU BOUTON RETOUR (Simplifiée grâce aux ancres # du site)
            BackHandler(enabled = true) {
                if (webView.canGoBack()) {
                    // Si Android voit qu'il peut reculer (grâce au # dans l'URL), il le fait
                    webView.goBack()
                } else {
                    // Si on est sur l'accueil, sécurité double clic pour quitter
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastBackTime < 2000) {
                        (context as? Activity)?.finish()
                    } else {
                        Toast.makeText(context, "Appuyez encore pour quitter", Toast.LENGTH_SHORT).show()
                        lastBackTime = currentTime
                    }
                }
            }

            // Affichage de la WebView en plein écran
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { webView }
>>>>>>> 5896176 (Sauvegarde complète locale avant synchronisation)
=======
                }
>>>>>>> Stashed changes
            )
        }
    }
}
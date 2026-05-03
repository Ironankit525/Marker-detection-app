package com.markerscanner

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.io.File

@ReactModule(name = MarkerNativeModule.NAME)
class MarkerNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MarkerNativeModule"
        private const val TAG = "MarkerNativeModule"
    }

    private val plugin = MarkerProcessorPlugin(reactContext)

    override fun getName(): String = NAME

    /**
     * Process a frame's Y-plane byte data for marker detection.
     * Called from JS with the base64-encoded Y-plane data and orientation.
     */
    @ReactMethod
    fun processFrame(yPlaneBase64: String, width: Int, height: Int, currentCount: Int, orientation: String, promise: Promise) {
        try {
            Log.d(TAG, "processFrame: ${width}x${height}, orientation=$orientation, count=$currentCount")
            val saveDir = getSaveDir()
            val yPlane = android.util.Base64.decode(yPlaneBase64, android.util.Base64.DEFAULT)
            val result = plugin.processFrame(yPlane, width, height, saveDir, currentCount, orientation)

            if (result != null) {
                promise.resolve(result)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing frame", e)
            promise.reject("PROCESS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun initOpenCV(promise: Promise) {
        try {
            MarkerProcessorPlugin.initOpenCV()
            Log.d(TAG, "OpenCV initialized successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "OpenCV init failed", e)
            promise.reject("OPENCV_INIT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearCache(promise: Promise) {
        try {
            val saveDir = getSaveDir()
            plugin.clearMarkerCache(saveDir)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    private fun getSaveDir(): String {
        val dir = File(reactApplicationContext.cacheDir, "markers")
        if (!dir.exists()) dir.mkdirs()
        return dir.absolutePath
    }
}

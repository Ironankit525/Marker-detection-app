package com.markerscanner

import android.graphics.ImageFormat
import android.media.Image
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.opencv.android.OpenCVLoader
import org.opencv.core.*
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import java.nio.ByteBuffer

class MarkerProcessorPlugin(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val TAG = "MarkerProcessor"
        private const val OUTPUT_SIZE = 300
        private const val MIN_CONTOUR_AREA = 5000.0
        private const val ASPECT_RATIO_LOW = 0.5
        private const val ASPECT_RATIO_HIGH = 2.0
        private const val MIN_FRAME_DIM = 2000
        private const val MAX_FRAME_DIM = 3000

        @Volatile
        private var opencvInitialized = false

        fun initOpenCV() {
            if (!opencvInitialized) {
                opencvInitialized = OpenCVLoader.initLocal()
                Log.d(TAG, "OpenCV initialized: $opencvInitialized")
            }
        }
    }

    private var markerCount = 0

    /**
     * Process a camera frame represented as a byte array (grayscale Y-plane).
     * Returns the file path of the saved marker image, or null if no marker found.
     */
    fun processFrame(yPlane: ByteArray, width: Int, height: Int, saveDir: String, currentCount: Int, orientation: String = "up"): String? {
        if (!opencvInitialized) {
            initOpenCV()
            if (!opencvInitialized) return null
        }

        markerCount = currentCount

        // 1. Create Mat from Y-plane
        val grayFull = Mat(height, width, CvType.CV_8UC1)
        grayFull.put(0, 0, yPlane)

        // 2. Rotate frame upright based on camera orientation
        val rotated = when (orientation) {
            "right" -> {
                val r = Mat()
                Core.rotate(grayFull, r, Core.ROTATE_90_COUNTERCLOCKWISE)
                grayFull.release()
                r
            }
            "left" -> {
                val r = Mat()
                Core.rotate(grayFull, r, Core.ROTATE_90_CLOCKWISE)
                grayFull.release()
                r
            }
            "down" -> {
                val r = Mat()
                Core.rotate(grayFull, r, Core.ROTATE_180)
                grayFull.release()
                r
            }
            else -> grayFull
        }

        val rotW = rotated.cols()
        val rotH = rotated.rows()

        // 3. Center-crop to square within 2000-3000px range
        val cropSize = when {
            minOf(rotW, rotH) in MIN_FRAME_DIM..MAX_FRAME_DIM -> minOf(rotW, rotH)
            minOf(rotW, rotH) > MAX_FRAME_DIM -> MAX_FRAME_DIM
            else -> minOf(rotW, rotH)
        }

        val cropX = (rotW - cropSize) / 2
        val cropY = (rotH - cropSize) / 2
        val roi = Rect(cropX, cropY, cropSize, cropSize)
        val gray = Mat(rotated, roi)

        // 4. Adaptive thresholding
        val binary = Mat()
        Imgproc.adaptiveThreshold(
            gray, binary, 255.0,
            Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
            Imgproc.THRESH_BINARY_INV,
            51, 10.0
        )

        // 5. Morphological Close to connect borders
        val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(11.0, 11.0))
        Imgproc.morphologyEx(binary, binary, Imgproc.MORPH_CLOSE, kernel)
        kernel.release()

        // 6. Find contours
        val contours = mutableListOf<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(
            binary, contours, hierarchy,
            Imgproc.RETR_LIST,
            Imgproc.CHAIN_APPROX_SIMPLE
        )
        
        Log.d(TAG, "Found ${contours.size} contours")

        var resultPath: String? = null
        var foundIncorrect = false

        // 7. Sort contours by area descending
        val sortedContours = contours.sortedByDescending { Imgproc.contourArea(it) }

        // 8. Process contours
        for (contour in sortedContours) {
            val area = Imgproc.contourArea(contour)
            if (area < MIN_CONTOUR_AREA) {
                Log.d(TAG, "Skipping contour: area $area < $MIN_CONTOUR_AREA")
                continue
            }

            // Approximate polygon with progressive epsilon
            val contour2f = MatOfPoint2f(*contour.toArray())
            val peri = Imgproc.arcLength(contour2f, true)
            val approx = MatOfPoint2f()
            
            var foundQuad = false
            for (eps in listOf(0.02, 0.04, 0.06, 0.08, 0.10)) {
                Imgproc.approxPolyDP(contour2f, approx, eps * peri, true)
                if (approx.rows() == 4) {
                    foundQuad = true
                    break
                }
            }

            if (!foundQuad) {
                Log.d(TAG, "Skipping contour: couldn't approximate to 4 corners (best was ${approx.rows()})")
                contour2f.release()
                approx.release()
                continue
            }

            // Validate aspect ratio
            val minRect = Imgproc.minAreaRect(contour2f)
            val rectWidth = minRect.size.width
            val rectHeight = minRect.size.height
            val aspectRatio = if (rectHeight > 0) maxOf(rectWidth, rectHeight) / minOf(rectWidth, rectHeight) else 999.0
            Log.d(TAG, "Validating contour: area=$area, approx=${approx.rows()} corners, aspect=$aspectRatio")

            if (aspectRatio < ASPECT_RATIO_LOW || aspectRatio > ASPECT_RATIO_HIGH) {
                Log.d(TAG, "Skipping contour: aspect ratio $aspectRatio out of bounds ($ASPECT_RATIO_LOW-$ASPECT_RATIO_HIGH)")
                contour2f.release()
                approx.release()
                continue
            }

            // 9. Order corners: TL, TR, BR, BL
            val corners = approx.toArray()
            val ordered = orderCorners(corners)

            // 10. Perspective transform to 300x300
            val srcPoints = MatOfPoint2f(*ordered)
            val dstPoints = MatOfPoint2f(
                Point(0.0, 0.0),
                Point(OUTPUT_SIZE.toDouble() - 1, 0.0),
                Point(OUTPUT_SIZE.toDouble() - 1, OUTPUT_SIZE.toDouble() - 1),
                Point(0.0, OUTPUT_SIZE.toDouble() - 1)
            )

            val perspectiveMatrix = Imgproc.getPerspectiveTransform(srcPoints, dstPoints)
            val warped = Mat()
            Imgproc.warpPerspective(
                gray, warped, perspectiveMatrix,
                Size(OUTPUT_SIZE.toDouble(), OUTPUT_SIZE.toDouble()),
                Imgproc.INTER_LINEAR,
                Core.BORDER_CONSTANT,
                Scalar(255.0)
            )

            // 11. Verify marker signature
            val detection = detectMarker(warped)
            if (detection == null) {
                // Not a marker at all
                warped.release()
                perspectiveMatrix.release()
                srcPoints.release()
                dstPoints.release()
                contour2f.release()
                approx.release()
                continue
            }
            
            if (detection.isIncorrect) {
                warped.release()
                perspectiveMatrix.release()
                srcPoints.release()
                dstPoints.release()
                contour2f.release()
                approx.release()
                foundIncorrect = true
                continue
            }

            Log.d(TAG, "Anchor quadrant: ${detection.currentQuad}, target: ${detection.targetQuad}")

            // 12. Rotate to upright
            val corrected = rotateToQuadrant(warped, detection.currentQuad, detection.targetQuad)

            // 13. Save image
            val fileName = "marker_${System.currentTimeMillis()}_${markerCount}.jpg"
            val filePath = File(saveDir, fileName).absolutePath
            Imgcodecs.imwrite(filePath, corrected)
            Log.d(TAG, "Marker saved: $filePath (anchor was in quadrant ${detection.currentQuad})")

            resultPath = filePath

            // Cleanup
            corrected.release()
            warped.release()
            perspectiveMatrix.release()
            srcPoints.release()
            dstPoints.release()
            contour2f.release()
            approx.release()
            break // Only process the first valid marker per frame
        }

        // Cleanup
        rotated.release()
        gray.release()
        binary.release()
        hierarchy.release()
        contours.forEach { it.release() }

        if (resultPath == null && foundIncorrect) {
            return "ERROR: INCORRECT_IMAGE"
        }

        return resultPath
    }

    /**
     * Order 4 corners as: Top-Left, Top-Right, Bottom-Right, Bottom-Left
     * Uses sum (x+y) and difference (y-x) to classify.
     * This method works correctly regardless of marker rotation angle.
     */
    private fun orderCorners(corners: Array<Point>): Array<Point> {
        val sorted = Array(4) { Point() }

        val sums = corners.map { it.x + it.y }
        val diffs = corners.map { it.y - it.x }

        sorted[0] = corners[sums.indexOf(sums.min())]   // TL: smallest sum
        sorted[2] = corners[sums.indexOf(sums.max())]   // BR: largest sum
        sorted[1] = corners[diffs.indexOf(diffs.min())]  // TR: smallest difference
        sorted[3] = corners[diffs.indexOf(diffs.max())]  // BL: largest difference

        return sorted
    }

    data class MarkerDetection(val currentQuad: Int, val targetQuad: Int, val isIncorrect: Boolean = false)

    /**
     * Analyze the warped 300x300 marker to find the current orientation and the target orientation.
     */
    private fun detectMarker(warped: Mat): MarkerDetection? {
        val binary = Mat()
        Imgproc.threshold(warped, binary, 0.0, 255.0, Imgproc.THRESH_BINARY + Imgproc.THRESH_OTSU)

        val h = warped.rows()
        val w = warped.cols()

        // Normalize Ink Polarity: Ensure marker ink is WHITE (255) and paper is BLACK (0)
        val borderThickness = (minOf(h, w) * 0.05).toInt() 
        val topStrip = Mat(binary, Rect(0, 0, w, borderThickness))
        val bottomStrip = Mat(binary, Rect(0, h - borderThickness, w, borderThickness))
        val leftStrip = Mat(binary, Rect(0, 0, borderThickness, h))
        val rightStrip = Mat(binary, Rect(w - borderThickness, 0, borderThickness, h))
        
        val topWhite = Core.countNonZero(topStrip).toDouble() / (w * borderThickness)
        val bottomWhite = Core.countNonZero(bottomStrip).toDouble() / (w * borderThickness)
        val leftWhite = Core.countNonZero(leftStrip).toDouble() / (borderThickness * h)
        val rightWhite = Core.countNonZero(rightStrip).toDouble() / (borderThickness * h)
        
        topStrip.release()
        bottomStrip.release()
        leftStrip.release()
        rightStrip.release()
        
        val avgBorderWhite = (topWhite + bottomWhite + leftWhite + rightWhite) / 4.0
        
        // If avgBorderWhite < 0.5, the border (ink) is mostly 0 (black). We must invert.
        val inkMat = if (avgBorderWhite < 0.5) {
            val inv = Mat()
            Core.bitwise_not(binary, inv)
            inv
        } else {
            binary.clone()
        }
        binary.release()

        // Now inkMat ALWAYS has ink = 255 (white) and paper = 0 (black).
        
        // Analyze border types
        val topInk = Core.countNonZero(Mat(inkMat, Rect(0, 0, w, borderThickness))).toDouble() / (w * borderThickness)
        val bottomInk = Core.countNonZero(Mat(inkMat, Rect(0, h - borderThickness, w, borderThickness))).toDouble() / (w * borderThickness)
        val leftInk = Core.countNonZero(Mat(inkMat, Rect(0, 0, borderThickness, h))).toDouble() / (borderThickness * h)
        val rightInk = Core.countNonZero(Mat(inkMat, Rect(w - borderThickness, 0, borderThickness, h))).toDouble() / (borderThickness * h)

        Log.d(TAG, "Border ink ratios: T=$topInk, B=$bottomInk, L=$leftInk, R=$rightInk")

        val solidThreshold = 0.75
        val isTopSolid = topInk > solidThreshold
        val isBottomSolid = bottomInk > solidThreshold
        val isLeftSolid = leftInk > solidThreshold
        val isRightSolid = rightInk > solidThreshold

        val solidCount = listOf(isTopSolid, isBottomSolid, isLeftSolid, isRightSolid).count { it }

        if (solidCount == 2) {
            Log.d(TAG, "Detected Type 2 Marker (L-border)")
            inkMat.release()
            val targetQuad = 3
            if (isTopSolid && isLeftSolid) return MarkerDetection(0, targetQuad) // TL
            if (isTopSolid && isRightSolid) return MarkerDetection(1, targetQuad) // TR
            if (isBottomSolid && isRightSolid) return MarkerDetection(2, targetQuad) // BR
            if (isBottomSolid && isLeftSolid) return MarkerDetection(3, targetQuad) // BL
            return null
        }

        if (solidCount == 3) {
            Log.d(TAG, "Detected incorrect marker: 3 solid edges")
            inkMat.release()
            return MarkerDetection(-1, -1, true) // Incorrect Marker
        }

        if (solidCount < 2) {
            val isDashed = topInk in 0.2..0.8 && bottomInk in 0.2..0.8 && leftInk in 0.2..0.8 && rightInk in 0.2..0.8
            if (isDashed) {
                Log.d(TAG, "Detected incorrect marker: Dashed borders on all sides")
                inkMat.release()
                return MarkerDetection(-1, -1, true) // Incorrect Marker
            }
            
            Log.d(TAG, "Invalid border: only $solidCount solid edges")
            inkMat.release()
            return null // Not a marker
        }

        // Check corner regions for the anchor dot
        val borderSkip = (minOf(h, w) * 0.18).toInt()
        val cornerSize = (minOf(h, w) * 0.15).toInt()

        if (borderSkip + cornerSize > h / 2 || borderSkip + cornerSize > w / 2) {
            inkMat.release()
            return null
        }

        val corners = arrayOf(
            Mat(inkMat, Rect(borderSkip, borderSkip, cornerSize, cornerSize)), // TL
            Mat(inkMat, Rect(w - borderSkip - cornerSize, borderSkip, cornerSize, cornerSize)), // TR
            Mat(inkMat, Rect(w - borderSkip - cornerSize, h - borderSkip - cornerSize, cornerSize, cornerSize)), // BR
            Mat(inkMat, Rect(borderSkip, h - borderSkip - cornerSize, cornerSize, cornerSize)) // BL
        )

        val totalCornerPixels = (cornerSize * cornerSize).toDouble()
        val inkRatios = corners.map { 
            Core.countNonZero(it).toDouble() / totalCornerPixels
        }

        Log.d(TAG, "Corner ink ratios: TL=${inkRatios[0]}, TR=${inkRatios[1]}, BR=${inkRatios[2]}, BL=${inkRatios[3]}")

        corners.forEach { it.release() }
        inkMat.release()

        // Find anchor quadrant
        val maxIdx = inkRatios.indexOf(inkRatios.maxOrNull() ?: 0.0)
        val maxRatio = inkRatios[maxIdx]

        if (maxRatio < 0.10) {
            Log.d(TAG, "No anchor found: max ink ratio $maxRatio < 0.10")
            return MarkerDetection(-1, -1, true)
        }
        
        if (maxRatio > 0.90) {
            Log.d(TAG, "Anchor too big: max ink ratio $maxRatio > 0.90")
            return MarkerDetection(-1, -1, true)
        }

        val emptyCorners = inkRatios.count { it < 0.08 }
        if (emptyCorners < 2) {
            Log.d(TAG, "Not enough empty corners: $emptyCorners < 2")
            return MarkerDetection(-1, -1, true)
        }

        Log.d(TAG, "Anchor detected in quadrant $maxIdx (ink ratio=${maxRatio})")
        return MarkerDetection(maxIdx, 0)
    }

    /**
     * Rotate the image so the current quadrant is moved to the target quadrant.
     * Quads: 0=TL, 1=TR, 2=BR, 3=BL (clockwise order)
     */
    private fun rotateToQuadrant(mat: Mat, currentQuad: Int, targetQuad: Int): Mat {
        if (currentQuad == targetQuad) return mat.clone()
        
        // Calculate clockwise 90-degree rotations needed
        val rotations = (targetQuad - currentQuad + 4) % 4
        
        val result = Mat()
        when (rotations) {
            1 -> Core.rotate(mat, result, Core.ROTATE_90_CLOCKWISE)
            2 -> Core.rotate(mat, result, Core.ROTATE_180)
            3 -> Core.rotate(mat, result, Core.ROTATE_90_COUNTERCLOCKWISE)
            else -> mat.copyTo(result)
        }
        return result
    }

    /**
     * Delete all marker images from the save directory.
     */
    fun clearMarkerCache(saveDir: String) {
        val dir = File(saveDir)
        if (dir.exists()) {
            dir.listFiles()?.filter { it.name.startsWith("marker_") && it.name.endsWith(".jpg") }?.forEach {
                it.delete()
                Log.d(TAG, "Deleted: ${it.absolutePath}")
            }
        }
    }
}

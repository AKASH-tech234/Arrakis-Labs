import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { previewCSV, uploadCSV } from "../../services/admin/adminApi";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  Eye,
  ArrowRight,
} from "lucide-react";

const CSVUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handlePreview = async () => {
    if (!file) return;
    
    setPreviewing(true);
    setError(null);
    
    try {
      const response = await previewCSV(file);
      if (response.success) {
        setPreview(response.preview);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to preview CSV");
      if (err.response?.data?.errors) {
        setError(`Validation errors:\n${err.response.data.errors.join("\n")}`);
      }
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const response = await uploadCSV(file);
      if (response.success) {
        setResult(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload CSV");
      if (err.response?.data?.errors) {
        setError(`Upload failed:\n${err.response.data.errors.join("\n")}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `title,description,difficulty,constraints,examples,test_cases,tags
Two Sum,"Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",Easy,"2 <= nums.length <= 10^4
-10^9 <= nums[i] <= 10^9","[{""input"": ""[2,7,11,15], target=9"", ""output"": ""[0,1]"", ""explanation"": ""Because nums[0] + nums[1] == 9""}]","[{""input"": {""nums"": [2,7,11,15], ""target"": 9}, ""expected_output"": [0,1], ""is_hidden"": false}, {""input"": {""nums"": [3,2,4], ""target"": 6}, ""expected_output"": [1,2], ""is_hidden"": false}, {""input"": {""nums"": [3,3], ""target"": 6}, ""expected_output"": [0,1], ""is_hidden"": true}]","[""Array"", ""Hash Table""]"`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CSV Upload</h1>
          <p className="text-gray-400 mt-1">Bulk import questions from CSV file</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          isDragActive
            ? "border-orange-500 bg-orange-500/10"
            : file
            ? "border-green-500 bg-green-500/10"
            : "border-gray-600 hover:border-gray-500 bg-gray-800/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          {file ? (
            <>
              <FileSpreadsheet className="h-12 w-12 text-green-400 mb-3" />
              <p className="text-lg font-medium text-white">{file.name}</p>
              <p className="text-sm text-gray-400 mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Click or drag to replace
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-lg font-medium text-white">
                {isDragActive ? "Drop the file here" : "Drag & drop CSV file"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                or click to browse (max 5MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      {file && !result && (
        <div className="flex gap-4">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {previewing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
            Preview
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            Upload
          </button>
        </div>
      )}

      {/* Preview Results */}
      {preview && !result && (
        <div className="p-6 rounded-xl bg-gray-800/50 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gray-700/50">
              <p className="text-sm text-gray-400">Total Rows</p>
              <p className="text-2xl font-bold text-white">{preview.totalRows}</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10">
              <p className="text-sm text-gray-400">Valid</p>
              <p className="text-2xl font-bold text-green-400">{preview.validRows}</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10">
              <p className="text-sm text-gray-400">Invalid</p>
              <p className="text-2xl font-bold text-red-400">{preview.invalidRows}</p>
            </div>
          </div>

          {/* Row Details */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {preview.rows?.map((row, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  row.valid ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {row.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-white font-medium">{row.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    row.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                    row.difficulty === "Medium" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {row.difficulty}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {row.testCaseCount} test cases
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Success */}
      {result && (
        <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Upload Successful!</h3>
              <p className="text-sm text-gray-400">
                {result.questionsCreated} questions and {result.testCasesCreated} test cases created
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {result.questions?.map((q, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-gray-800/50 flex items-center justify-between"
              >
                <span className="text-white">{q.title}</span>
                <span className="text-sm text-gray-400">{q.testCases} test cases</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/admin/questions")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium transition-colors"
          >
            View Questions
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="p-6 rounded-xl bg-gray-800/50 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">CSV Format Guide</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="font-mono text-orange-400 w-32 flex-shrink-0">title*</span>
            <span className="text-gray-400">Question title (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-orange-400 w-32 flex-shrink-0">description*</span>
            <span className="text-gray-400">Problem description (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-orange-400 w-32 flex-shrink-0">difficulty*</span>
            <span className="text-gray-400">Easy, Medium, or Hard (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-gray-500 w-32 flex-shrink-0">constraints</span>
            <span className="text-gray-400">Problem constraints</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-gray-500 w-32 flex-shrink-0">examples</span>
            <span className="text-gray-400">JSON array of visible examples</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-gray-500 w-32 flex-shrink-0">test_cases</span>
            <span className="text-gray-400">JSON array with {"input", "expected_output"} (+ optional "is_hidden", "label", "time_limit", "memory_limit"). First 2 are visible by default; rest run as hidden on Submit.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-gray-500 w-32 flex-shrink-0">tags</span>
            <span className="text-gray-400">JSON array or comma-separated tags</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVUpload;

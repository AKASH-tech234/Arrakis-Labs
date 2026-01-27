import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
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
    maxSize: 5 * 1024 * 1024, 
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
    <div className="max-w-4xl mx-auto space-y-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-[#D97706] to-[#D97706]/20 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8E4D9] uppercase tracking-wider flex items-center gap-2">
              <Upload className="h-6 w-6 text-[#D97706]" />
              CSV Upload
            </h1>
            <p className="text-sm text-[#78716C]">Bulk import questions from CSV file</p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F0F0D] hover:bg-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] transition-colors border border-[#1A1814] hover:border-[#D97706]/40 font-medium"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
      </div>

      {}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        {...getRootProps()}
        className={`p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragActive
            ? "border-[#D97706] bg-[#D97706]/10"
            : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-[#1A1814] hover:border-[#D97706]/40 bg-[#0F0F0D]"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          {file ? (
            <>
              <FileSpreadsheet className="h-12 w-12 text-emerald-400 mb-3" />
              <p className="text-lg font-semibold text-[#E8E4D9]">{file.name}</p>
              <p className="text-sm text-[#78716C] mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-[#78716C] mt-2">
                Click or drag to replace
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-[#78716C] mb-3" />
              <p className="text-lg font-semibold text-[#E8E4D9]">
                {isDragActive ? "Drop the file here" : "Drag & drop CSV file"}
              </p>
              <p className="text-sm text-[#78716C] mt-1">
                or click to browse (max 5MB)
              </p>
            </>
          )}
        </div>
      </motion.div>

      {}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        </motion.div>
      )}

      {}
      {file && !result && (
        <div className="flex gap-4">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0F0F0D] hover:bg-[#1A1814] text-[#E8E4D9] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#1A1814] hover:border-[#D97706]/40"
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#D97706]/20"
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

      {}
      {preview && !result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-[#0F0F0D] border border-[#1A1814]"
        >
          <h3 className="text-lg font-semibold text-[#E8E4D9] mb-4 uppercase tracking-wide">Preview</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#0A0A08] border border-[#1A1814]">
              <p className="text-sm text-[#78716C] uppercase tracking-wide">Total Rows</p>
              <p className="text-2xl font-bold text-[#E8E4D9]">{preview.totalRows}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30">
              <p className="text-sm text-[#78716C] uppercase tracking-wide">Valid</p>
              <p className="text-2xl font-bold text-emerald-400">{preview.validRows}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/30">
              <p className="text-sm text-[#78716C] uppercase tracking-wide">Invalid</p>
              <p className="text-2xl font-bold text-red-400">{preview.invalidRows}</p>
            </div>
          </div>

          {}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {preview.rows?.map((row, index) => (
              <div
                key={index}
                className={`p-3 rounded-xl flex items-center justify-between ${
                  row.valid ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-red-500/5 border border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {row.valid ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-[#E8E4D9] font-medium">{row.title}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${
                    row.difficulty === "Easy" ? "bg-[#78716C]/10 text-[#78716C] border-[#78716C]/30" :
                    row.difficulty === "Medium" ? "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30" :
                    "bg-[#92400E]/10 text-[#92400E] border-[#92400E]/30"
                  }`}>
                    {row.difficulty}
                  </span>
                </div>
                <span className="text-sm text-[#78716C]">
                  {row.testCaseCount} test cases
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {}
      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/30"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <h3 className="text-lg font-semibold text-[#E8E4D9]">Upload Successful!</h3>
              <p className="text-sm text-[#78716C]">
                {result.questionsCreated} questions and {result.testCasesCreated} test cases created
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {result.questions?.map((q, index) => (
              <div
                key={index}
                className="p-3 rounded-xl bg-[#0F0F0D] border border-[#1A1814] flex items-center justify-between"
              >
                <span className="text-[#E8E4D9]">{q.title}</span>
                <span className="text-sm text-[#78716C]">{q.testCases} test cases</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/admin/questions")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium transition-colors border border-emerald-500/30"
          >
            View Questions
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-xl bg-[#0F0F0D] border border-[#1A1814]"
      >
        <h3 className="text-lg font-semibold text-[#E8E4D9] mb-4 uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-[#D97706]" />
          CSV Format Guide
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#D97706] w-32 flex-shrink-0">title*</span>
            <span className="text-[#78716C]">Question title (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#D97706] w-32 flex-shrink-0">description*</span>
            <span className="text-[#78716C]">Problem description (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#D97706] w-32 flex-shrink-0">difficulty*</span>
            <span className="text-[#78716C]">Easy, Medium, or Hard (required)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#78716C] w-32 flex-shrink-0">constraints</span>
            <span className="text-[#78716C]">Problem constraints</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#78716C] w-32 flex-shrink-0">examples</span>
            <span className="text-[#78716C]">JSON array of visible examples</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#78716C] w-32 flex-shrink-0">test_cases</span>
            <span className="text-[#78716C]">JSON array with {"input", "expected_output"} (+ optional "is_hidden", "label", "time_limit", "memory_limit"). First 2 are visible by default; rest run as hidden on Submit.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-[#78716C] w-32 flex-shrink-0">tags</span>
            <span className="text-[#78716C]">JSON array or comma-separated tags</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CSVUpload;

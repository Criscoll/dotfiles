return
{
    'ggml-org/llama.vim',
    init = function()
        vim.g.llama_config = {
            endpoint_fim = "http://127.0.0.1:8012/infill",
            auto_fim = false,
        }
    end,
}

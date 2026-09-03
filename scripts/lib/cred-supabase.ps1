# Lê o access token do Supabase CLI no Gerenciador de Credenciais do Windows
# (target "Supabase CLI:supabase"). O blob é UTF-8 (token sbp_...).
# Uso: . "$PSScriptRoot\cred-supabase.ps1"; $token = Get-SupabaseCliToken
# O token nunca é impresso.

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class CredMan {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll")]
    public static extern void CredFree(IntPtr cred);

    public static string ReadPassword(string target) {
        IntPtr ptr;
        if (!CredRead(target, 1, 0, out ptr)) {
            throw new Exception("CredRead falhou, erro " + Marshal.GetLastWin32Error());
        }
        CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
        string password = null;
        if (cred.CredentialBlobSize > 0) {
            byte[] blob = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, blob, 0, (int)cred.CredentialBlobSize);
            // o Supabase CLI grava o token em UTF-8 (sem terminador nulo)
            password = System.Text.Encoding.UTF8.GetString(blob).TrimEnd('\0');
        }
        CredFree(ptr);
        return password;
    }
}
"@

function Get-SupabaseCliToken {
    $token = [CredMan]::ReadPassword("Supabase CLI:supabase")
    if ([string]::IsNullOrEmpty($token)) { throw "Token vazio no Gerenciador de Credenciais." }
    return $token
}
